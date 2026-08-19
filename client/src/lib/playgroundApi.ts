export type PlaygroundApiOptions = {
  model: string;
  prompt: string;
  stream?: boolean;
  jsonMode?: boolean;
  tools?: boolean;
};

const endpoint = "https://kiwi-router.vercel.app/api/v1/chat/completions";

function payload(options: PlaygroundApiOptions) {
  return {
    model: options.model,
    messages: [{ role: "user", content: options.prompt }],
    stream: Boolean(options.stream),
    ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(options.tools ? { tools: [{ type: "function", function: { name: "lookup_status", description: "Look up a service status", parameters: { type: "object", properties: {}, additionalProperties: false } } }] } : {}),
  };
}

export function generatePlaygroundApis(options: PlaygroundApiOptions) {
  const request = JSON.stringify(payload(options), null, 2);
  const compact = JSON.stringify(payload(options));
  return {
    curl: `curl ${endpoint} \\\n  -H "Authorization: Bearer $KIWI_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${compact}'`,
    javascript: `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${process.env.KIWI_API_KEY}\`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${request})\n});\n\nconst data = await response.json();\nconsole.log(data.choices?.[0]?.message?.content ?? data);`,
    python: `import os\nimport requests\n\nresponse = requests.post(\n    "${endpoint}",\n    headers={"Authorization": f"Bearer {os.environ['KIWI_API_KEY']}"},\n    json=${request.replace(/\n/g, "\n    ")},\n    timeout=60,\n)\nresponse.raise_for_status()\nprint(response.json()["choices"][0]["message"]["content"])`,
    streaming: `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: { "Authorization": \`Bearer \${process.env.KIWI_API_KEY}\`, "Content-Type": "application/json" },\n  body: JSON.stringify(${JSON.stringify(payload({ ...options, stream: true }), null, 2)})\n});\n\nfor await (const chunk of response.body) {\n  process.stdout.write(new TextDecoder().decode(chunk));\n}`,
  };
}
