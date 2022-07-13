import { parseMixed } from '@lezer/common';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { Element, MarkdownExtension } from '@lezer/markdown';
import { foldInside, foldNodeProp, StreamLanguage } from '@codemirror/language';
import { styleTags, tags } from '@lezer/highlight';

// A frontmatter fence usually consists of a seperator used three times.
// These can be: ---, +++, ===, etc.
// FIXME: make this configurable
const frontMatterFence = /^---\s*$/m;

/**
 * Ixora frontmatter plugin for Markdown.
 */
export const frontmatter: MarkdownExtension = {
	defineNodes: [{ name: 'Frontmatter', block: true }, 'FrontmatterMark'],
	props: [
		styleTags({
			Frontmatter: [tags.documentMeta, tags.monospace],
			FrontmatterMark: tags.processingInstruction,
		}),
		foldNodeProp.add({
			Frontmatter: foldInside,
			// Marks don't need to be folded
			/* c8 ignore next */
			FrontmatterMark: () => null,
		}),
	],
	wrap: parseMixed((node) => {
		const { parser } = StreamLanguage.define(yaml);
		if (node.type.name === 'Frontmatter') {
			return {
				parser,
				overlay: [{ from: node.from + 4, to: node.to - 4 }],
			};
		} else {
			return null;
		}
	}),
	parseBlock: [
		{
			name: 'Fronmatter',
			before: 'HorizontalRule',
			parse: (cx, line) => {
				const children = new Array<Element>();
				if (cx.lineStart === 0 && frontMatterFence.test(line.text)) {
					// 4 is the length of the frontmatter fence (---\n).
					children.push(cx.elt('FrontmatterMark', 0, 4));
					while (cx.nextLine()) {
						if (frontMatterFence.test(line.text)) {
							break;
						}
					}
					const end = cx.lineStart + 4;
					children.push(cx.elt('FrontmatterMark', cx.lineStart, end));
					cx.addElement(cx.elt('Frontmatter', 0, end, children));
					return true;
				} else {
					return false;
				}
			},
		},
	],
};
