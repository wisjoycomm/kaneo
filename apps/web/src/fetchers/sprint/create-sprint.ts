import { client } from "@kaneo/libs";

async function createSprint(
  projectId: string,
  data: {
    name: string;
    goal?: string;
    duration?: string;
    startDate?: string;
    endDate?: string;
  },
) {
  const response = await client.sprint.project[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createSprint;
