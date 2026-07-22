import { client } from "@kaneo/libs";

async function setTaskParent(
  id: string,
  parentTaskId: string | null,
  type?: "task" | "epic",
) {
  const response = await client.task[":id"].parent.$put({
    param: { id },
    json: { parentTaskId, type },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default setTaskParent;
