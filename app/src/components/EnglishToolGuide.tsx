import type { ToolDefinition } from '../registry'
import { toolArticleHtml } from '../lib/toolContent'
import { relatedToolsHtml } from '../lib/categoryHubs'
import { relatedGuidesHtml } from '../lib/guideCatalog'

/** Public help copy loads with a tool, without increasing catalog startup. */
export default function EnglishToolGuide({ tool }: { tool: ToolDefinition }) {
  return <div dangerouslySetInnerHTML={{ __html: toolArticleHtml(tool.id, tool.title) + relatedToolsHtml(tool) + relatedGuidesHtml(tool.id) }} />
}
