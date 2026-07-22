import { client } from "@kaneo/libs";

async function getEpics(projectId: string) {
  const response = await client.task.epics[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getEpics;
