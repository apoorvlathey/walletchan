/**
 * EIP-712 Typed Data Validation
 *
 * Validates EIP-712 signature requests to prevent denial-of-service attacks
 * from malicious dapps sending deeply nested types or circular references.
 *
 * References:
 * - https://eips.ethereum.org/EIPS/eip-712
 * - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md#parameters
 */

export interface EIP712ValidationResult {
  valid: boolean;
  error?: string;
}

// Maximum allowed nesting depth for type definitions
// Legitimate DeFi protocols rarely exceed 10 levels
const MAX_NESTING_DEPTH = 50;

/**
 * Validates EIP-712 typed data structure
 * Only validates eth_signTypedData_v3 and eth_signTypedData_v4
 */
export function validateEIP712TypedData(
  method: string,
  typedData: any
): EIP712ValidationResult {
  // Only validate v3 and v4 (v1 is deprecated, personal_sign/eth_sign have no schema)
  if (method !== "eth_signTypedData_v3" && method !== "eth_signTypedData_v4") {
    return { valid: true };
  }

  // Parse if stringified
  let data: any;
  try {
    data = typeof typedData === "string" ? JSON.parse(typedData) : typedData;
  } catch (e) {
    return { valid: false, error: "Invalid JSON in typed data" };
  }

  // Validate required fields exist
  if (!data.types || typeof data.types !== "object") {
    return { valid: false, error: "Missing or invalid 'types' field" };
  }

  if (!data.domain || typeof data.domain !== "object") {
    return { valid: false, error: "Missing or invalid 'domain' field" };
  }

  if (!data.primaryType || typeof data.primaryType !== "string") {
    return { valid: false, error: "Missing or invalid 'primaryType' field" };
  }

  if (!data.message || typeof data.message !== "object") {
    return { valid: false, error: "Missing or invalid 'message' field" };
  }

  // Check for circular references
  const circularCheck = detectCircularReferences(data.types);
  if (!circularCheck.valid) {
    return circularCheck;
  }

  // Check nesting depth
  const depthCheck = validateNestingDepth(data.types, MAX_NESTING_DEPTH);
  if (!depthCheck.valid) {
    return depthCheck;
  }

  // Validate type definitions conform to EIP-712
  const typeCheck = validateTypeDefinitions(data.types);
  if (!typeCheck.valid) {
    return typeCheck;
  }

  return { valid: true };
}

/**
 * Detects circular references in type definitions using DFS
 * Example: Type A → Type B → Type C → Type A
 */
function detectCircularReferences(
  types: Record<string, any>
): EIP712ValidationResult {
  const visiting = new Set<string>(); // Currently visiting in this path
  const visited = new Set<string>(); // Fully processed

  function visit(typeName: string): boolean {
    // Circular reference detected (found type already in current path)
    if (visiting.has(typeName)) {
      return true;
    }

    // Already fully processed this type
    if (visited.has(typeName)) {
      return false;
    }

    // Primitive types are terminal (no further traversal needed)
    if (isPrimitiveType(typeName)) {
      return false;
    }

    // Check if type exists in schema
    const typeFields = types[typeName];
    if (!typeFields || !Array.isArray(typeFields)) {
      // Invalid type definition, will be caught by validateTypeDefinitions
      return false;
    }

    // Mark as visiting (in current DFS path)
    visiting.add(typeName);

    // Visit all referenced types
    for (const field of typeFields) {
      if (!field.type) continue;

      // Extract base type (strip array notation like "Foo[]")
      const baseType = field.type.replace(/\[\]$/, "");

      // Recursively check referenced type
      if (visit(baseType)) {
        return true; // Circular reference found in child
      }
    }

    // Done visiting this type
    visiting.delete(typeName);
    visited.add(typeName);
    return false;
  }

  // Check all types for circular references
  for (const typeName of Object.keys(types)) {
    if (typeName === "EIP712Domain") continue; // Skip domain

    if (visit(typeName)) {
      return {
        valid: false,
        error: `Circular reference detected in type '${typeName}'`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates nesting depth using DFS with memoization
 * Prevents stack overflow from deeply nested types (e.g., 60,825 levels)
 */
function validateNestingDepth(
  types: Record<string, any>,
  maxDepth: number
): EIP712ValidationResult {
  const visited = new Map<string, number>(); // typeName -> max depth from this type

  function getDepth(typeName: string, currentDepth: number): number {
    // Exceeded maximum depth
    if (currentDepth > maxDepth) {
      return currentDepth;
    }

    // Primitive types have depth 0
    if (isPrimitiveType(typeName)) {
      return currentDepth;
    }

    // Check memoized result
    const cachedDepth = visited.get(typeName);
    if (cachedDepth !== undefined) {
      return currentDepth + cachedDepth;
    }

    const typeFields = types[typeName];
    if (!typeFields || !Array.isArray(typeFields)) {
      return currentDepth;
    }

    let maxChildDepth = 0;

    // Find maximum depth among all fields
    for (const field of typeFields) {
      if (!field.type) continue;

      // Extract base type (strip array notation)
      const baseType = field.type.replace(/\[\]$/, "");
      const childDepth = getDepth(baseType, currentDepth + 1);

      // Early exit if exceeded
      if (childDepth > maxDepth) {
        return childDepth;
      }

      maxChildDepth = Math.max(maxChildDepth, childDepth - currentDepth);
    }

    // Memoize the relative depth from this type
    visited.set(typeName, maxChildDepth);
    return currentDepth + maxChildDepth;
  }

  // Check all types
  for (const typeName of Object.keys(types)) {
    if (typeName === "EIP712Domain") continue;

    const depth = getDepth(typeName, 0);
    if (depth > maxDepth) {
      return {
        valid: false,
        error: `Type '${typeName}' exceeds maximum nesting depth of ${maxDepth} (found ${depth})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates type definitions conform to EIP-712 spec
 * Each type must be an array of {name, type} objects
 */
function validateTypeDefinitions(
  types: Record<string, any>
): EIP712ValidationResult {
  for (const [typeName, fields] of Object.entries(types)) {
    // Each type must be an array
    if (!Array.isArray(fields)) {
      return {
        valid: false,
        error: `Type '${typeName}' must be an array of field definitions`,
      };
    }

    // Validate each field definition
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (typeof field !== "object" || field === null) {
        return {
          valid: false,
          error: `Type '${typeName}' field ${i} is not an object`,
        };
      }

      if (!field.name || typeof field.name !== "string") {
        return {
          valid: false,
          error: `Type '${typeName}' field ${i} missing or invalid 'name'`,
        };
      }

      if (!field.type || typeof field.type !== "string") {
        return {
          valid: false,
          error: `Type '${typeName}' field '${field.name}' missing or invalid 'type'`,
        };
      }

      // Validate referenced type exists (primitive or defined in schema)
      const baseType = field.type.replace(/\[\]$/, "");
      if (!isValidTypeName(baseType, types)) {
        return {
          valid: false,
          error: `Type '${typeName}' field '${field.name}' has undefined type '${baseType}'`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Checks if a type is a primitive EIP-712 type
 */
function isPrimitiveType(type: string): boolean {
  // Common primitives
  if (["address", "bool", "string", "bytes"].includes(type)) {
    return true;
  }

  // uint8 to uint256 (8-bit increments)
  // int8 to int256 (8-bit increments)
  if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/.test(type)) {
    return true;
  }

  // bytes1 to bytes32
  if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])$/.test(type)) {
    return true;
  }

  return false;
}

/**
 * Checks if a type name is valid (primitive or defined in schema)
 */
function isValidTypeName(type: string, types: Record<string, any>): boolean {
  return isPrimitiveType(type) || type in types;
}
