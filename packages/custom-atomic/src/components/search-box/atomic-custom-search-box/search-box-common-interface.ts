import { Bindings, SearchBoxSuggestionElement } from '@coveo/atomic';
import { InsightBindings } from '@coveo/atomic/dist/types/components/insight/atomic-insight-interface/atomic-insight-interface';
import { QuerySetActionCreators } from '@coveo/headless';

export interface SearchBoxCommonProps {
  id: string;
  bindings: InsightBindings | Bindings;
  querySetActions: QuerySetActionCreators;
  focusValue: (value: HTMLElement) => void;
  clearSuggestions: () => void;
  getIsSearchDisabled: () => boolean;
  getIsExpanded: () => boolean;
  getPanelInFocus: () => HTMLElement | undefined;
  getActiveDescendant: () => string;
  getActiveDescendantElement: () => HTMLElement | null;
  getAllSuggestionElements: () => SearchBoxSuggestionElement[];
}
