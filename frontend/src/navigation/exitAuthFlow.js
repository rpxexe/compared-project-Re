// Leaves the sign-in flow (Login and anything pushed after it, e.g. AuthWelcome).
// If Login was opened from inside the app (e.g. the "sign in to enquire" prompt), return
// there; otherwise - first launch, where the stack is Welcome -> Login - replace the whole
// stack with the main tabs.
export default function exitAuthFlow(navigation) {
  const { routes = [], index = 0 } = navigation.getState?.() || {};
  let loginIdx = index;
  for (let i = index; i >= 0; i -= 1) {
    if (routes[i]?.name === "Login") {
      loginIdx = i;
      break;
    }
  }
  const prev = routes[loginIdx - 1]?.name;
  if (prev && prev !== "Welcome") navigation.pop(index - loginIdx + 1);
  else navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
}
