import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { GoogleGenAI, Modality } from '@google/genai';

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolResponse {
  content: ContentItem[];
  isError?: boolean;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.join(os.tmpdir(), "gemini-mcp");

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const handle = async ({
  prompt,
}: {
  prompt: string,
}): Promise<CallToolResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    let i = 0;
    const fileInfos: Array<{path: string, size: string}> = []
    const fileDatas: Array<{ data: string, mimeType: string }> = []

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      i++;
      // Based on the part type, either show the text or save the image
      if (part.text) {
        console.error(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data!;
        const buffer = Buffer.from(imageData, "base64");
        const firstThreeWords = prompt.replace(/\W/g, " ").replace(/ +/g, " ").split(" ").slice(0, 3).join("-").toLowerCase();

        // Ensure the output directory exists
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // Save the original image
        const writtenPath = path.join(OUTPUT_DIR, `gemini-${firstThreeWords}-${Date.now()}-${i}.png`);
        await fs.writeFile(writtenPath, buffer);
        fileInfos.push({path: writtenPath, size: imageData.length / 1024 + " KB"});

        const mimeType = part?.inlineData?.mimeType
        const PADDING = 1024

        // Claude desktop doesn't support images > 1MB
        if (mimeType && imageData.length < 1 * 1024 * 1024 - PADDING) {
          fileDatas.push({
            data: imageData,
            mimeType: mimeType
          });
        }
      }
    }

    return {
      content: [
        { type: 'text', text: `Wrote files to ${fileInfos.map(fi => `${fi.path} (${fi.size})`).join(", ")}` },
        ...fileDatas.map(({ data, mimeType }) => ({
          type: 'image' as const,
          data,
          mimeType
        }))
      ],
    }
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      content: [{ type: 'text', text: `Error generating image: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
}
async function main(): Promise<void> {
  // Create MCP server
  const server = new McpServer({
    name: 'Gemini Image Generator',
    version: '1.0.0'
  });

  // Add the image generation tool
  server.tool(
    'generate_image',
    {
      prompt: z.string().describe('Detailed text description of the image to generate'),
    },
    handle
  );

  // Start the server with stdio transport
  const transport = new StdioServerTransport();

  console.error('Starting Gemini MCP Image Generation Server...');

  // Connect the server to the transport
  try {
    await server.connect(transport);
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

// Run the server
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
