# MCP Registry publishing

The repository includes `server.json` for the public Bizcraw remote MCP server.

## Prepared values

- Registry name: `io.github.thnthnh7/bizcraw`
- Public guide: `https://bizcraw.com/mcp`
- Remote endpoint: `https://bizcraw.com/api/mcp`
- Transport: Streamable HTTP
- Source repository: `https://github.com/thnthnh7/BD-tool`

## Publish procedure

1. Download the current `mcp-publisher` binary from the official MCP Registry releases.
2. From the repository root, run `mcp-publisher login github` and complete GitHub authentication for the `thnthnh7` account.
3. Run `mcp-publisher validate` and resolve every reported schema or namespace error.
4. Run `mcp-publisher publish` only after the production MCP smoke tests pass.
5. Confirm the published version through the official Registry API and increment `version` for each later release.

Publishing is deliberately not automatic on every application deploy. A Registry version is a public release artifact and should follow a passing production MCP test.
