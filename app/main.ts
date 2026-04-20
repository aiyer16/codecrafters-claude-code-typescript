import OpenAI from "openai";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "user", content: prompt }]

  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: [{
        "type": "function",
        "function": {
          "name": "Read",
          "description": "Read and return the contents of a file",
          "parameters": {
            "type": "object",
            "properties": {
              "file_path": {
                "type": "string",
                "description": "The path to the file to read"
              }
            },
            "required": ["file_path"]
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "Write",
          "description": "Write content to a file",
          "parameters": {
            "type": "object",
            "required": ["file_path", "content"],
            "properties": {
              "file_path": {
                "type": "string",
                "description": "The path of the file to write to"
              },
              "content": {
                "type": "string",
                "description": "The content to write to the file"
              }
            }
          }
        }
      },
      {
        "type": "function",
        "function": {
          "name": "Bash",
          "description": "Execute a shell command",
          "parameters": {
            "type": "object",
            "required": ["command"],
            "properties": {
              "command": {
                "type": "string",
                "description": "The command to execute"
              }
            }
          }
        }
      }]
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    // You can use print statements as follows for debugging, they'll be visible when running tests.
    console.error("Logs from your program will appear here!");

    // TODO: Uncomment the lines below to pass the first stage
    const message = response.choices[0].message;
    messages.push(message)

    if (message.tool_calls !== undefined) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type == "function" && toolCall.function.name == "Read") {
          const args = JSON.parse(toolCall.function.arguments);
          const filePath = args.file_path;

          const result = await Bun.file(filePath).text()
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: result })
        } else if (toolCall.type == "function" && toolCall.function.name == "Write") {
          const args = JSON.parse(toolCall.function.arguments);
          const filePath = args.file_path;
          const content = args.content

          const result = await Bun.write(filePath, content)
          messages.push({
            role: "tool", tool_call_id: toolCall.id, content: `Wrote ${result} bytes to
  ${filePath}`
          })
        } else if (toolCall.type == "function" && toolCall.function.name == "Bash") {
          const args = JSON.parse(toolCall.function.arguments);
          const command = args.command;

          const result = await Bun.$`sh -c ${command}`.quiet();
          const output = result.stdout.toString() || result.stderr.toString()
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: output })
        }
      }
    } else {
      console.log(response.choices[0].message.content);
      return
    }
  }
}


main();
