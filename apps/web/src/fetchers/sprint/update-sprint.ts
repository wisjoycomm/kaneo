import { client } from "@kaneo/libs";

async function updateSprint(
  id: string,
  data: {
    name?: string;
    goal?: string;
    duration?: string;
    startDate?: string;
    endDate?: string;
  },
) {
  const response = await client.sprint[":id"].$put({
    param: { id },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateSprint;
