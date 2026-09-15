import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  // __MACOSX holds the AppleDouble "._" files a macOS zip leaves behind. They
  // are not source — they are binary resource forks that happen to end in .ts,
  // and every one of them fails to parse. Left in, `npm run lint` reported 237
  // errors on a clean tree and a real one had nowhere to show.
  { ignores: ["_reference/**", "__MACOSX/**", ".next/**", "node_modules/**"] },
];

export default config;
