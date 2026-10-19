/**
 * Tab-root header checks (UI-R15b, DESIGN_SYSTEM §5.2 revised UI-R15): the `h1` title sits in the
 * 56 bar (`${headerTestID}-title`), and pinned controls are never inside the scrolling list.
 */
type TreeNode = { parent: TreeNode | null; props: { testID?: unknown } };

/** True when `node` is rendered inside the element with `testID`. */
export const isInside = (node: TreeNode, testID: string): boolean => {
  for (let current = node.parent; current; current = current.parent) {
    if (current.props.testID === testID) return true;
  }
  return false;
};
