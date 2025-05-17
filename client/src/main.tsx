import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// URL params to extract email for authentication
const params = new URLSearchParams(window.location.search);
const email = params.get('email');

createRoot(document.getElementById("root")!).render(
  <App initialEmail={email} />
);
