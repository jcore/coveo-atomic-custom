import { isNullOrUndefined } from '@coveo/bueno';
import {
  Bindings,
  RedirectionPayload,
  SearchBoxSuggestionElement,
  SearchBoxSuggestions,
  SearchBoxSuggestionsBindings,
  SearchBoxSuggestionsEvent,
  initializeBindings,
} from '@coveo/atomic';
import { Component, Element, EventEmitter, h, Prop, State, Event, Listen, Watch } from '@stencil/core';
import {
  SearchStatusState,
  buildSearchStatus,
  Unsubscribe,
  loadQuerySetActions,
  QuerySetActionCreators,
  SearchBoxOptions,
  buildStandaloneSearchBox,
  buildSearchBox,
  StandaloneSearchBox,
  SearchBox,
  SearchBoxState,
  StandaloneSearchBoxState,
} from '@coveo/headless';
import { waitForAtomic } from '../../../utils/atomic';
import { once, randomID } from '../../../utils/utils';
import { SafeStorage, StandaloneSearchBoxData, StorageItems } from '../../../utils/local-storage-utils';
import { SearchBoxWrapper } from './search-box-wrapper';
import { SubmitButton } from './submit-button';
import { SearchInput } from './search-input';
import { SearchBoxCommon } from './search-box-common';
import { AriaLiveRegion } from '../../../utils/accessibility-utils';
import { promiseTimeout } from '../../../utils/promise-utils';
import { isMacOS } from '../../../utils/device-utils';
import { ButtonSearchSuggestion, SimpleSearchSuggestion, queryDataAttribute } from './search-suggestion';
import { elementHasNoQuery, elementHasQuery } from '../atomic-custom-search-box-query-suggestions/suggestions-common';
import { updateBreakpoints } from '../../../utils/replace-breakpoint';

/**
 The `atomic-custom-search-box` component creates a search box with built-in support for suggestions.
*/
@Component({
  tag: 'atomic-custom-search-box',
  styleUrl: 'atomic-custom-search-box.css',
  shadow: true,
})
export class AtomicCustomSearchBox {
  // The Atomic bindings to be resolved on the parent atomic-search-interface.
  // Used to access the Headless engine in order to create controllers, dispatch actions, access state, etc.
  public bindings!: Bindings;

  // We recommend recording possible errors thrown during the configuration.
  public error!: Error;
  private searchBox!: SearchBox | StandaloneSearchBox;
  private id!: string;
  private querySetActions!: QuerySetActionCreators;
  private inputRef!: HTMLInputElement;
  private searchBoxCommon!: SearchBoxCommon;
  private leftPanelRef: HTMLElement | undefined;
  private rightPanelRef: HTMLElement | undefined;
  private suggestions: SearchBoxSuggestions[] = [];
  private suggestionEvents: SearchBoxSuggestionsEvent[] = [];

  // When disconnecting components from the page, we recommend removing
  // state change listeners as well by calling the unsubscribe methods.
  private statusUnsubscribe: Unsubscribe = () => {};
  private searchBoxUnsubscribe: Unsubscribe = () => {};

  @Element() private host!: HTMLElement;

  // Headless controller state property, using the `@State()` decorator.
  // Headless will automatically update these objects when the state related
  // to the controller has changed.
  @State() private statusState!: SearchStatusState;
  @State() private isExpanded = false;
  @State() private isSearchDisabled = false;
  @State() private searchBoxState!: SearchBoxState | StandaloneSearchBoxState;
  @State() private activeDescendant = '';
  @State() private previousActiveDescendantElement: HTMLElement | null = null;
  @State() private leftSuggestions: SearchBoxSuggestions[] = [];
  @State() private leftSuggestionElements: SearchBoxSuggestionElement[] = [];
  @State() private rightSuggestions: SearchBoxSuggestions[] = [];
  @State() private rightSuggestionElements: SearchBoxSuggestionElement[] = [];
  @State() private suggestedQuery = '';
  @State() private suggestionElements: SearchBoxSuggestionElement[] = [];

  /**
   * The amount of queries displayed when the user interacts with the search box.
   * By default, a mix of query suggestions and recent queries will be shown.
   * You can configure those settings using the following components as children:
   *  - atomic-search-box-query-suggestions
   *  - atomic-search-box-recent-queries
   */
  @Prop({ reflect: true }) public numberOfQueries = 8;

  /**
   * Whether to prevent the user from triggering searches and query suggestions from the component.
   * Perfect for use cases where you need to disable the search conditionally.
   */
  @Prop({ reflect: true }) public disableSearch = false;

  /**
   * The minimum query length required to enable search.
   * For example, to disable the search for empty queries, set this to `1`.
   */
  @Prop({ reflect: true }) public minimumQueryLength = 0;

  /**
   * Whether to clear all active query filters when the end user submits a new query from the search box.
   * Setting this option to "false" is not recommended & can lead to an increasing number of queries returning no results.
   */
  @Prop({ reflect: true }) public clearFilters = true;

  /**
   * Whether to interpret advanced [Coveo Cloud query syntax](https://docs.coveo.com/en/1814/) in the query.
   * You should only enable query syntax in the search box if you have good reasons to do so, as it
   * requires end users to be familiar with Coveo Cloud query syntax, otherwise they will likely be surprised
   * by the search box behaviour.
   *
   * When the `redirection-url` property is set and redirects to a page with more `atomic-search-box` components, all `atomic-search-box` components need to have the same `enable-query-syntax` value.
   */
  @Prop({ reflect: true }) public enableQuerySyntax = false;

  /**
   * Defining this option makes the search box standalone (see [Use a
   * Standalone Search Box](https://docs.coveo.com/en/atomic/latest/usage/ssb/)).
   *
   * This option defines the default URL the user should be redirected to, when a query is submitted.
   * If a query pipeline redirect is triggered, it will redirect to that URL instead
   * (see [query pipeline triggers](https://docs.coveo.com/en/1458)).
   */
  @Prop({ reflect: true }) public redirectionUrl?: string;

  /**
   * The timeout for suggestion queries, in milliseconds.
   * If a suggestion query times out, the suggestions from that particular query won't be shown.
   */
  @Prop() public suggestionTimeout = 400;

  /**
   * Event that is emitted when a standalone search box redirection is triggered. By default, the search box will directly change the URL and redirect accordingly, so if you want to handle the redirection differently, use this event.
   *
   * Example:
   * ```html
   * <script>
   *   document.querySelector('atomic-search-box').addEventListener((e) => {
   *     e.preventDefault();
   *     // handle redirection
   *   });
   * </script>
   * ...
   * <atomic-search-box redirection-url="/search"></atomic-search-box>
   * ```
   */
  @Event({
    eventName: 'redirect',
  })
  public redirect!: EventEmitter<RedirectionPayload>;

  @AriaLiveRegion('search-box')
  protected searchBoxAriaMessage!: string;

  @AriaLiveRegion('search-suggestions', true)
  protected suggestionsAriaMessage!: string;

  @Listen('atomic/searchBoxSuggestion/register')
  public registerSuggestions(event: CustomEvent<SearchBoxSuggestionsEvent>) {
    event.preventDefault();
    event.stopPropagation();
    this.suggestionEvents.push(event.detail);
    if (this.searchBox) {
      this.suggestions.push(event.detail(this.suggestionBindings));
    }
  }

  @Watch('redirectionUrl')
  watchRedirectionUrl() {
    this.connectedCallback();
  }

  private get suggestionBindings(): SearchBoxSuggestionsBindings {
    return {
      ...this.bindings,
      id: this.id,
      isStandalone: !!this.redirectionUrl,
      searchBoxController: this.searchBox,
      numberOfQueries: this.numberOfQueries,
      clearFilters: this.clearFilters,
      suggestedQuery: () => this.suggestedQuery,
      clearSuggestions: () => this.clearSuggestions(),
      triggerSuggestions: () => this.triggerSuggestions(),
      getSuggestions: () => this.suggestions,
      getSuggestionElements: () => this.allSuggestionElements,
    };
  }

  private updateBreakpoints = once(() => updateBreakpoints(this.host));

  // We recommend initializing the bindings and the Headless controllers
  // using the `connectedCallback` lifecycle method with async/await.
  // Using `componentWillLoad` will hang the parent atomic-search-interface initialization.
  public async connectedCallback() {
    try {
      // Wait for the Atomic to load and bindings to be resolved.
      await waitForAtomic();
      this.bindings = await initializeBindings(this.host);

      // Initialize controllers.
      const statusController = buildSearchStatus(this.bindings.engine);
      const searchBoxController = buildSearchBox(this.bindings.engine);

      this.id = randomID('atomic-search-box-');
      this.querySetActions = loadQuerySetActions(this.bindings.engine);
      console.log(this.querySetActions, this.id);

      this.isSearchDisabled = this.disableSearch || this.minimumQueryLength > 0;

      const searchBoxOptions: SearchBoxOptions = {
        id: this.id,
        numberOfSuggestions: 0,
        highlightOptions: {
          notMatchDelimiters: {
            open: '<span class="font-bold">',
            close: '</span>',
          },
          correctionDelimiters: {
            open: '<span class="font-normal">',
            close: '</span>',
          },
        },
        clearFilters: this.clearFilters,
        enableQuerySyntax: this.enableQuerySyntax,
      };

      this.searchBox = this.redirectionUrl
        ? buildStandaloneSearchBox(this.bindings.engine, {
            options: { ...searchBoxOptions, redirectionUrl: this.redirectionUrl },
          })
        : buildSearchBox(this.bindings.engine, {
            options: searchBoxOptions,
          });

      this.suggestions = this.suggestionEvents.map(event => event(this.suggestionBindings));

      this.searchBoxCommon = new SearchBoxCommon({
        id: this.id,
        bindings: this.bindings,
        querySetActions: this.querySetActions,
        focusValue: this.focusValue.bind(this),
        clearSuggestions: this.clearSuggestions.bind(this),
        getIsSearchDisabled: () => this.isSearchDisabled,
        getIsExpanded: () => this.isExpanded,
        getPanelInFocus: () => this.panelInFocus,
        getActiveDescendant: () => this.activeDescendant,
        getActiveDescendantElement: () => this.activeDescendantElement,
        getAllSuggestionElements: () => this.allSuggestionElements,
      });

      // Subscribe to controller state changes.
      this.statusUnsubscribe = statusController.subscribe(() => (this.statusState = statusController.state));
      this.searchBoxUnsubscribe = statusController.subscribe(() => (this.searchBoxState = searchBoxController.state));
    } catch (error) {
      console.error(error);
      this.error = error as Error;
    }
  }

  private get allSuggestionElements() {
    return [...this.leftSuggestionElements, ...this.rightSuggestionElements];
  }

  private get panelInFocus() {
    if (this.leftPanelRef?.contains(this.activeDescendantElement)) {
      return this.leftPanelRef;
    }
    if (this.rightPanelRef?.contains(this.activeDescendantElement)) {
      return this.rightPanelRef;
    }
    return this.leftPanelRef || this.rightPanelRef;
  }

  private clearSuggestions() {
    this.isExpanded = false;
    this.updateActiveDescendant();
    this.clearSuggestionElements();
  }

  private clearSuggestionElements() {
    this.leftSuggestionElements = [];
    this.rightSuggestionElements = [];
    this.searchBoxAriaMessage = '';
  }

  private updateActiveDescendant(activeDescendant = '') {
    this.activeDescendant = activeDescendant;
  }

  private updateDescendants(activeDescendant = '') {
    const newPrevDescendantElement = this.activeDescendantElement;

    this.updateActiveDescendant(activeDescendant);
    this.previousActiveDescendantElement = newPrevDescendantElement;
  }

  private get activeDescendantElement(): HTMLElement | null {
    if (!this.searchBoxCommon.hasActiveDescendant) {
      return null;
    }

    return this.leftPanelRef?.querySelector(`#${this.activeDescendant}`) || this.rightPanelRef?.querySelector(`#${this.activeDescendant}`) || null;
  }

  private focusValue(value: HTMLElement) {
    this.updateActiveDescendant(value.id);
    this.searchBoxCommon.scrollActiveDescendantIntoView();
    this.updateQueryFromSuggestion();
    this.updateAriaLiveActiveDescendant(value);
  }

  private updateQueryFromSuggestion() {
    const suggestedQuery = this.activeDescendantElement?.getAttribute(queryDataAttribute);
    if (suggestedQuery && this.searchBoxState.value !== suggestedQuery) {
      this.searchBoxCommon.updateQuery(suggestedQuery);
      this.updateSuggestedQuery(suggestedQuery);
    }
  }

  private getSuggestionElements(suggestions: SearchBoxSuggestions[]) {
    const elements = suggestions.map(suggestion => suggestion.renderItems()).flat();
    const max = this.numberOfQueries + elements.filter(elementHasNoQuery).length;

    return elements.slice(0, max);
  }

  private getAndFilterLeftSuggestionElements() {
    const suggestionElements = this.getSuggestionElements(this.leftSuggestions);
    const filterOnDuplicate = new Set();

    return suggestionElements.filter(suggestionElement => {
      if (isNullOrUndefined(suggestionElement.query)) {
        return true;
      }
      if (filterOnDuplicate.has(suggestionElement.query)) {
        return false;
      } else {
        filterOnDuplicate.add(suggestionElement.query);
        return true;
      }
    });
  }

  private isPanelInFocus(panel: HTMLElement | undefined, query: string): boolean {
    if (!this.activeDescendantElement) {
      return false;
    }

    if (query) {
      const escaped = query.replace(/"/g, '\\"');
      return !!panel?.querySelector(`[${queryDataAttribute}="${escaped}"]`);
    }

    return this.activeDescendantElement?.closest('ul') === panel;
  }

  private updateAriaLiveActiveDescendant(value: HTMLElement) {
    if (isMacOS()) {
      this.suggestionsAriaMessage = value.ariaLabel!;
    }
  }

  private focusPanel(panel: HTMLElement | undefined) {
    if (this.panelInFocus === panel) {
      return;
    }
    if (panel && panel.firstElementChild) {
      const panelHasActiveDescendant = this.previousActiveDescendantElement && panel.contains(this.previousActiveDescendantElement);
      const newValue = panelHasActiveDescendant ? this.previousActiveDescendantElement! : (panel.firstElementChild as HTMLElement);
      this.updateDescendants(newValue.id);
      this.updateAriaLiveActiveDescendant(newValue);
    }
  }

  public componentWillUpdate() {
    if (!('redirectTo' in this.searchBoxState) || !('afterRedirection' in this.searchBox)) {
      return;
    }

    const { redirectTo, value, analytics } = this.searchBoxState;

    if (redirectTo === '') {
      return;
    }
    const data: StandaloneSearchBoxData = {
      value,
      enableQuerySyntax: this.enableQuerySyntax,
      analytics,
    };
    const storage = new SafeStorage();
    storage.setJSON(StorageItems.STANDALONE_SEARCH_BOX_DATA, data);

    this.searchBox.afterRedirection();
    const event = this.redirect.emit({ redirectTo, value });
    if (!event.defaultPrevented) {
      window.location.href = redirectTo;
    }
  }

  private onInput(value: string) {
    this.isSearchDisabled = this.disableSearch || this.minimumQueryLength > value.trim().length;
    if (this.isSearchDisabled) {
      return;
    }
    this.isExpanded = true;
    this.searchBox.updateText(value);
    this.updateActiveDescendant();
    this.triggerSuggestions();
  }

  private onFocus() {
    this.isExpanded = true;
    this.triggerSuggestions();
  }

  private onSubmit() {
    if (this.activeDescendantElement) {
      this.activeDescendantElement.click();
      this.updateActiveDescendant();
      return;
    }

    this.searchBox.submit();
    this.updateActiveDescendant();
    this.clearSuggestions();
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.isSearchDisabled) {
      return;
    }

    switch (e.key) {
      case 'Enter':
        this.onSubmit();
        break;
      case 'Escape':
        this.clearSuggestions();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.searchBoxCommon.focusNextValue();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.searchBoxCommon.firstValue === this.activeDescendantElement) {
          this.updateActiveDescendant();
        } else {
          this.searchBoxCommon.focusPreviousValue();
        }
        break;
      case 'ArrowRight':
        if (this.activeDescendant || !this.searchBox.state.value) {
          e.preventDefault();
          this.focusPanel(this.rightPanelRef);
        }
        break;
      case 'ArrowLeft':
        if (this.activeDescendant || !this.searchBox.state.value) {
          e.preventDefault();
          this.focusPanel(this.leftPanelRef);
        }
        break;
      case 'Tab':
        this.clearSuggestions();
        break;
    }
  }

  private get isDoubleList() {
    return Boolean(this.leftSuggestionElements.length && this.rightSuggestionElements.length);
  }

  private updateAriaMessage() {
    const elsLength = this.suggestionElements.filter(elementHasQuery).length;
    this.searchBoxAriaMessage = elsLength
      ? this.bindings.i18n.t('query-suggestions-available', {
          count: elsLength,
        })
      : this.bindings.i18n.t('query-suggestions-unavailable');
  }

  private sortSuggestions(a: SearchBoxSuggestions, b: SearchBoxSuggestions) {
    return a.position - b.position;
  }

  private async triggerSuggestions() {
    if (this.disableSearch) {
      return;
    }
    const settled = await Promise.allSettled(
      this.suggestions.map(suggestion => promiseTimeout(suggestion.onInput ? suggestion.onInput() : Promise.resolve(), this.suggestionTimeout)),
    );

    console.log('trigger', this.suggestions);

    const fulfilledSuggestions: SearchBoxSuggestions[] = [];

    settled.forEach((prom, j) => {
      if (prom.status === 'fulfilled') {
        fulfilledSuggestions.push(this.suggestions[j]);
      } else {
        this.bindings.engine.logger.warn('Some query suggestions are not being shown because the promise timed out.');
      }
    });

    const splitSuggestions = (side: 'left' | 'right', isDefault = false) =>
      fulfilledSuggestions.filter(suggestion => suggestion.panel === side || (!suggestion.panel && isDefault)).sort(this.sortSuggestions);

    this.leftSuggestions = splitSuggestions('left', true);
    this.leftSuggestionElements = this.getAndFilterLeftSuggestionElements();

    this.rightSuggestions = splitSuggestions('right');
    this.rightSuggestionElements = this.getSuggestionElements(this.rightSuggestions);

    const defaultSuggestedQuery = this.allSuggestionElements.find(elementHasQuery)?.query || '';

    this.updateSuggestedQuery(defaultSuggestedQuery);
    this.updateAriaMessage();
  }

  // The `disconnectedCallback` lifecycle method should be used to unsubcribe controllers and
  // possibly the i18n language change listener.
  public disconnectedCallback() {
    this.statusUnsubscribe();
    this.searchBoxUnsubscribe();
  }

  private renderPanel(side: 'left' | 'right', elements: SearchBoxSuggestionElement[], setRef: (el: HTMLElement | undefined) => void, getRef: () => HTMLElement | undefined) {
    if (!elements.length) {
      return null;
    }

    return (
      <div
        part={`suggestions suggestions-${side}`}
        ref={setRef}
        class="flex flex-grow basis-1/2 flex-col"
        onMouseDown={e => {
          if (e.target === getRef()) {
            e.preventDefault();
          }
        }}
      >
        {elements.map((suggestion, index) => this.renderSuggestion(suggestion, index, elements.length - 1, side))}
      </div>
    );
  }

  private onSuggestionMouseOver(item: SearchBoxSuggestionElement, side: 'left' | 'right', id: string) {
    const thisPanel = side === 'left' ? this.leftPanelRef : this.rightPanelRef;
    if (this.panelInFocus === thisPanel) {
      this.updateActiveDescendant(id);
    } else {
      this.updateDescendants(id);
    }
    if (item.query) {
      this.updateSuggestedQuery(item.query);
    }
  }

  private renderSuggestion(item: SearchBoxSuggestionElement, index: number, lastIndex: number, side: 'left' | 'right') {
    const id = `${this.id}-${side}-suggestion-${item.key}`;

    const isSelected = id === this.activeDescendant || (this.suggestedQuery === item.query && !this.panelInFocus?.getAttribute('part')?.includes(side));

    if (index === lastIndex && item.hideIfLast) {
      return null;
    }
    const isButton = item.onSelect || item.query;

    if (!isButton) {
      return (
        <SimpleSearchSuggestion
          bindings={this.bindings}
          id={id}
          suggestion={item}
          isSelected={isSelected}
          side={side}
          index={index}
          lastIndex={lastIndex}
          isDoubleList={this.isDoubleList}
        ></SimpleSearchSuggestion>
      );
    }

    return (
      <ButtonSearchSuggestion
        bindings={this.bindings}
        id={id}
        suggestion={item}
        isSelected={isSelected}
        side={side}
        index={index}
        lastIndex={lastIndex}
        isDoubleList={this.isDoubleList}
        onClick={(e: Event) => {
          this.searchBoxCommon.onSuggestionClick(item, e);
        }}
        onMouseOver={() => {
          this.onSuggestionMouseOver(item, side, id);
        }}
      ></ButtonSearchSuggestion>
    );
  }

  private renderSuggestions() {
    if (!this.searchBoxCommon.hasSuggestions) {
      return null;
    }

    return (
      <div
        id={this.searchBoxCommon.popupId}
        part={`suggestions-wrapper ${this.isDoubleList ? 'suggestions-double-list' : 'suggestions-single-list'}`}
        class={`flex w-full z-10 absolute left-0 top-full rounded-md bg-background border border-neutral ${this.searchBoxCommon.showSuggestions ? '' : 'hidden'}`}
        role="application"
        aria-label={this.bindings.i18n.t(this.isDoubleList ? 'search-suggestions-double-list' : 'search-suggestions-single-list')}
        aria-activedescendant={this.activeDescendant}
      >
        {this.renderPanel(
          'left',
          this.leftSuggestionElements,
          el => (this.leftPanelRef = el),
          () => this.leftPanelRef,
        )}
        {this.renderPanel(
          'right',
          this.rightSuggestionElements,
          el => (this.rightPanelRef = el),
          () => this.rightPanelRef,
        )}
      </div>
    );
  }

  private async updateSuggestedQuery(suggestedQuery: string) {
    const query = this.bindings.store.isMobile() ? '' : suggestedQuery;
    await Promise.allSettled(
      this.suggestions.map(suggestion => promiseTimeout(suggestion.onSuggestedQueryChange ? suggestion.onSuggestedQueryChange(query) : Promise.resolve(), this.suggestionTimeout)),
    );
    this.suggestedQuery = query;
    this.updateSuggestionElements(query);
  }

  private updateSuggestionElements(query: string) {
    if (!this.isPanelInFocus(this.leftPanelRef, query)) {
      this.leftSuggestionElements = this.getAndFilterLeftSuggestionElements();
    }

    if (!this.isPanelInFocus(this.rightPanelRef, query)) {
      this.rightSuggestionElements = this.getSuggestionElements(this.rightSuggestions);
    }
  }

  public render() {
    console.log('render atomic-custom-search-box', this.suggestedQuery, this.bindings, this.isSearchDisabled);
    if (this.error) {
      return <p>Error when initializing the component, please view the console for more information.</p>;
    }

    if (!this.bindings || !this.statusState.hasResults) {
      return;
    }

    this.updateBreakpoints();
    const searchLabel = this.searchBoxCommon.getSearchInputLabel(this.minimumQueryLength);

    return [
      <SearchBoxWrapper disabled={this.isSearchDisabled}>
        <atomic-focus-detector style={{ display: 'contents' }} onFocusExit={() => this.clearSuggestions()}>
          <SearchInput
            inputRef={this.inputRef}
            loading={this.searchBoxState.isLoading}
            ref={el => (this.inputRef = el as HTMLInputElement)}
            bindings={this.bindings}
            value={this.searchBoxState.value}
            title={searchLabel}
            ariaLabel={searchLabel}
            onFocus={() => this.onFocus()}
            onInput={e => this.onInput((e.target as HTMLInputElement).value)}
            onKeyDown={e => this.onKeyDown(e)}
            onClear={() => this.searchBox.clear()}
            popup={{
              id: this.searchBoxCommon.popupId,
              activeDescendant: this.activeDescendant,
              expanded: this.isExpanded,
              hasSuggestions: this.searchBoxCommon.hasSuggestions,
            }}
          />
          {this.renderSuggestions()}
          <SubmitButton bindings={this.bindings} disabled={this.isSearchDisabled} onClick={() => this.searchBox.submit()} title={searchLabel} />
        </atomic-focus-detector>
      </SearchBoxWrapper>,
      !this.suggestions.length && (
        <slot>
          <atomic-custom-search-box-query-suggestions></atomic-custom-search-box-query-suggestions>
        </slot>
      ),
    ];
  }
}
