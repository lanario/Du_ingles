import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(baseUrl)) {
  throw new Error("Defina BASE_URL para o ambiente a testar.");
}

export const options = {
  vus: Number(__ENV.VUS || 2),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function publicSmoke() {
  const response = http.get(`${baseUrl}/`, { tags: { page: "landing" } });
  check(response, {
    "landing: HTTP 200": (r) => r.status === 200,
    "landing: HTML": (r) => (r.headers["Content-Type"] || "").includes("text/html"),
  });
  sleep(1);
}
