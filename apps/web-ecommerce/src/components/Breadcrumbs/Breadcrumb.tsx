export default function Breadcrumb({ pageName }: { pageName: string }) {
  // The global admin header supplies the visible location; keep the page title accessible.
  return <h1 className="sr-only">{pageName}</h1>;
}
