import { syntaxTree } from '@codemirror/language';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { Range } from '@codemirror/state';
import { headingSlugField } from '../state/heading_slug.ts';
import { checkRangeOverlap, invisibleDecoration } from '../util.ts';
import { link as classes } from '../classes.ts';

/**
 * Ixora Links plugin.
 *
 * This plugin allows to:
 * - Add an interactive link icon to a URL which can navigate to the URL.
 */
export const links = () => [goToLinkPlugin, baseTheme];

export class GoToLinkWidget extends WidgetType {
	constructor(readonly link: string) {
		super();
	}
	toDOM(view: EditorView): HTMLElement {
		const anchor = document.createElement('a');
		if (this.link.startsWith('#')) {
			// Handle links within the markdown document.
			const slugs = view.state.field(headingSlugField);
			anchor.addEventListener('click', () => {
				const pos = slugs.find((h) => h.slug === this.link.slice(1))?.pos;
				// pos could be zero, so instead check if its undefined
				if (typeof pos !== 'undefined') {
					const tr = view.state.update({
						selection: { anchor: pos },
						scrollIntoView: true,
					});
					view.dispatch(tr);
				}
			});
		} else anchor.href = this.link;
		anchor.target = '_blank';
		anchor.classList.add(classes.widget);
		anchor.textContent = '🔗';
		return anchor;
	}
}

function getLinkAnchor(view: EditorView) {
	const widgets = new Array<Range<Decoration>>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from, to, node }) => {
				if (type.name !== 'URL') return;
				const parent = node.parent;
				// FIXME: make this configurable
				const blackListedParents = ['Image'];
				if (parent && !blackListedParents.includes(parent.name)) {
					const marks = parent.getChildren('LinkMark');
					const ranges = view.state.selection.ranges;
					const cursorOverlaps = ranges.some(({ from, to }) =>
						checkRangeOverlap([from, to], [parent.from, parent.to])
					);
					if (!cursorOverlaps) {
						widgets.push(
							...marks.map(({ from, to }) =>
								invisibleDecoration.range(from, to)
							),
							invisibleDecoration.range(from, to),
						);
					}

					const dec = Decoration.widget({
						widget: new GoToLinkWidget(view.state.sliceDoc(from, to)),
						side: 1,
					});
					widgets.push(dec.range(to, to));
				}
			},
		});
	}

	return Decoration.set(widgets, true);
}

export const goToLinkPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet = Decoration.none;
		constructor(view: EditorView) {
			this.decorations = getLinkAnchor(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = getLinkAnchor(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations },
);

/**
 * Base theme for the links plugin.
 */
const baseTheme = EditorView.baseTheme({
	['.' + classes.widget]: {
		cursor: 'pointer',
		textDecoration: 'underline',
	},
});
