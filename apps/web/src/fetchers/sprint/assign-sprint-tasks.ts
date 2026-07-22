import { client } from "@kaneo/libs";

async function assignSprintTasks(id: string, add: string[], remove: string[]) {
  const response = await client.sprint[":id"].tasks.$put({
    param: { id },
    json: { add, remove },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default assignSprintTasks;
