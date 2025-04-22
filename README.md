# Gemini MCP Image Generation Server

A Model Context Protocol (MCP) server that integrates with Google's Gemini models for image generation, implemented in TypeScript. The server automatically downscales images using ImageMagick to make them more suitable for consumption by MCP clients like Claude.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file from the example:
   ```
   cp .env.example .env
   ```
4. Add your Gemini API key to the `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
5. Install ImageMagick (optional, but recommended for image downscaling):
   - On macOS: `brew install imagemagick`
   - On Ubuntu/Debian: `sudo apt-get install imagemagick`
   - On Windows: Download from https://imagemagick.org/script/download.php

## Building and Running

Build the TypeScript code:
```
npm run build
```

Run the server:
```
npm start
```

For development (build and run in one step):
```
npm run dev
```

## Using the server

This MCP server provides a single tool:

- `generate_image`: Generates images from text descriptions using Google's Gemini API

### Tool parameters

- `prompt` (required): Detailed text description of the image to generate
- `maxSizeMb` (optional): Maximum file size in megabytes for the preview image (default: 1MB)

## Image Processing

When ImageMagick is installed, the server will:
1. Generate the full-resolution image using Gemini
2. Save the original image to disk
3. Create an optimized preview image that's guaranteed to be under the size limit
4. Return the optimized version in the response

The adaptive image optimization process:
1. Starts with reasonable quality settings (800px max dimension, 85% quality)
2. Checks if the resulting file is under the target size (default: 900KB, which is 90% of 1MB)
3. If not, gradually reduces dimensions and quality until the target size is achieved
   - Uses a 10% safety margin below the specified maxSizeMb to ensure images stay under limits
4. Uses additional optimizations including:
   - Metadata stripping (EXIF, comments, etc.)
   - Chroma subsampling (4:2:0) for further size reduction
   - Progressive interlacing for better perceived loading
5. As a last resort, will use extreme measures (color reduction, heavy compression) if needed

This makes the server especially useful for integration with clients like Claude that may have limitations on handling large images. The original high-quality image is still preserved on disk.

## Implementation Details

This server is built using:

- TypeScript for type safety and better developer experience
- Model Context Protocol (MCP) for standardized LLM tool integration
- Google's Generative AI SDK for accessing the Gemini API
- ImageMagick for image processing
- Zod for runtime type validation

## Notes

- This tool requires a Gemini API key
- Generated images include a SynthID watermark
- Only English prompts are currently supported
- Both original and downscaled images are saved to disk
  - Default location: system temp directory in a folder named "gemini-mcp"
  - Can be customized with the OUTPUT_DIR environment variable