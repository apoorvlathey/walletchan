import dynamic from "next/dynamic";

const MigrateContent = dynamic(() => import("./MigrateContent"), {
  ssr: false,
});

export default function MigratePage() {
  return <MigrateContent />;
}
