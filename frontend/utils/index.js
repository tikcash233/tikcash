export function createPageUrl(name) {
  const map = {
    Home: "/",
    CreatorDashboard: "/creator",
    SupporterDashboard: "/support",
  // Browsing is consolidated on the supporter page; keep alias for any stray references
  BrowseCreators: "/support",
  };
  return map[name] || "/";
}
