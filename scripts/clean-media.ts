/**
 * Deletes uploaded photographs that no page uses any more, once they have been
 * out of use for a grace period (Admin → Site images keeps a replaced or
 * restored photo's file, so a mistake can still be undone by hand).
 *
 *   npm run clean-media                    what it would do, deleting nothing
 *   npm run clean-media -- --delete        do it
 *   npm run clean-media -- --days 7        a different grace period (default 30)
 *   npm run clean-media -- --days 0 --delete   delete every unused file now
 *
 * A file a photo record points to is never touched. The grace period counts
 * from when a file stopped being used (lib/media/retire), not from its upload.
 * A file nobody has noticed before gets its clock started on a --delete run, and
 * is deleted by a later run once the grace period has passed.
 */
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: [".env.local", ".env"], quiet: true });
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/nutridrip";

import { connectDB } from "../src/lib/db/mongoose";
import { MediaRetired, SiteMedia } from "../src/lib/models";
import { deleteFile, listFiles } from "../src/lib/storage";
import { DEFAULT_GRACE_DAYS, formatBytes, planCleanup } from "../src/lib/media/cleanup";

function args() {
  const argv = process.argv.slice(2);
  let days = DEFAULT_GRACE_DAYS;
  let doDelete = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--delete") doDelete = true;
    else if (a === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0) throw new Error("--days needs a whole number, 0 or more");
      days = n;
    } else throw new Error(`Unknown option "${a}". Use --delete and --days N.`);
  }
  return { days, doDelete };
}

async function main() {
  const { days, doDelete } = args();
  await connectDB();

  const [files, usedKeys, retiredRows] = await Promise.all([
    listFiles(),
    SiteMedia.distinct("file", { file: { $ne: null } }) as Promise<string[]>,
    MediaRetired.find().lean<Array<{ file: string; retiredAt: Date }>>(),
  ]);
  const used = new Set(usedKeys);
  const retired = new Map(retiredRows.map((r) => [r.file, r.retiredAt]));
  const now = new Date();
  const plan = planCleanup({ files, used, retired, now, graceDays: days });

  const when = (d: Date) => d.toISOString().slice(0, 10);
  console.log(`Stored photographs: ${files.length}  (${formatBytes(files.reduce((n, f) => n + f.bytes, 0))})`);
  console.log(`  in use:           ${plan.inUse.length}  (${formatBytes(plan.bytes.inUse)})   never touched`);
  console.log(
    `  waiting:          ${plan.waiting.length}  (${formatBytes(plan.bytes.waiting)})   unused, inside the ${days}-day grace period`
  );
  console.log(
    `  ready to delete:  ${plan.remove.length}  (${formatBytes(plan.bytes.remove)})   unused for ${days} days or more`
  );
  if (plan.mark.length)
    console.log(
      `  not seen before:  ${plan.mark.length}   their ${days}-day clock ${doDelete ? "starts now" : "would start on a --delete run"}`
    );
  for (const f of plan.remove)
    console.log(`    delete  ${f.key}  ${formatBytes(f.bytes)}  unused since ${when(f.since)}`);
  for (const f of plan.waiting.slice(0, 20))
    console.log(`    wait    ${f.key}  ${f.daysLeft} day${f.daysLeft === 1 ? "" : "s"} left`);
  if (plan.waiting.length > 20) console.log(`    … and ${plan.waiting.length - 20} more waiting`);

  if (!doDelete) {
    console.log("\nNothing was deleted. Run with --delete to do it.");
    return;
  }

  // Start the clock on files nobody has noticed.
  if (plan.mark.length) {
    await MediaRetired.insertMany(
      plan.mark.map((f) => ({ file: f.key, slot: null, reason: "noticed", retiredAt: now })),
      { ordered: false }
    ).catch(() => undefined); // a duplicate means another run marked it first
  }

  let deleted = 0;
  let freed = 0;
  for (const f of plan.remove) {
    // A photo may have started using it since the plan was made: look again.
    if (await SiteMedia.exists({ file: f.key })) {
      console.log(`    skipped ${f.key}: a photo uses it now`);
      continue;
    }
    await deleteFile(f.key);
    await MediaRetired.deleteOne({ file: f.key });
    deleted++;
    freed += f.bytes;
  }
  if (plan.staleRecords.length) await MediaRetired.deleteMany({ file: { $in: plan.staleRecords } });

  console.log(`\nDeleted ${deleted} file${deleted === 1 ? "" : "s"}, freed ${formatBytes(freed)}.`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
