export function createPageUrl(name) {
  const map = {
    Home: "/",
    CreatorDashboard: "/creator",
    SupporterDashboard: "/support",
    BrowseCreators: "/browse",
  };
  return map[name] || "/";
}
