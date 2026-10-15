// The stylesheet the server would inject for the demo colours (violet brand, navy contrast).
import fs from "node:fs";
import { brandCss } from "../../../../src/lib/theme";
fs.writeFileSync(process.argv[2], brandCss("#6d28d9", null, "#002e5c"));
