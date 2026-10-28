import { TestFailJobSchema, type TestFailJobData } from "@entrust/jobs";

export async function handleTestFail(jobData: TestFailJobData) {
  const data = TestFailJobSchema.parse(jobData);
  throw new Error(`Intentional job failure: ${data.reason}`);
}
