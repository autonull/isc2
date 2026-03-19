/**
 * Base UI Component for Vanilla JS architecture.
 * Provides a simple lifecycle for DOM-based components.
 */

export abstract class UIComponent<TProps = {}, TState = {}> {
  protected element: HTMLElement;
  protected props: TProps;
  protected state: TState;
  protected children: Map<string, UIComponent<any, any>>;

  constructor(tagName: string, props: TProps = {} as TProps, initialState: TState = {} as TState) {
    this.element = document.createElement(tagName);
    this.props = props;
    this.state = initialState;
    this.children = new Map();
  }

  /**
   * Get the root DOM element of this component.
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Update component state and surgically update DOM.
   */
  protected setState(newState: Partial<TState>): void {
    const prevState = this.state;
    this.state = { ...this.state, ...newState };
    this.update(prevState, this.props);
  }

  /**
   * Update component props and surgically update DOM.
   */
  public setProps(newProps: Partial<TProps>): void {
    const prevProps = this.props;
    this.props = { ...this.props, ...newProps };
    this.update(this.state, prevProps);
  }

  /**
   * Mount this component into a parent element.
   */
  public mount(parent: HTMLElement): void {
    parent.appendChild(this.element);
    this.render();
    this.onMount();
    this.update(this.state, this.props);
  }

  /**
   * Remove this component from the DOM and cleanup.
   */
  public unmount(): void {
    this.onUnmount();
    this.children.forEach(child => child.unmount());
    this.children.clear();

    if (this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }

  /**
   * Lifecycle hook: Called right after the component is mounted to the DOM.
   */
  protected onMount(): void {}

  /**
   * Lifecycle hook: Called right before the component is unmounted.
   */
  protected onUnmount(): void {}

  /**
   * Initial render method. Must be implemented by subclasses to define the baseline HTML
   * and attach event listeners once.
   */
  protected abstract render(): void;

  /**
   * Granular update method. Subclasses should implement this to surgically update the DOM
   * instead of wiping `innerHTML`. It receives previous state and props for comparison.
   */
  protected update(prevState: TState, prevProps: TProps): void {
    // Default fallback: do nothing.
    // Subclasses should implement granular DOM updates here.
  }

  /**
   * Helper to append or replace a child component safely.
   */
  protected appendChildComponent(id: string, child: UIComponent<any, any>, containerSelector?: string): void {
    // If there's an existing child with this ID, unmount it
    if (this.children.has(id)) {
      this.children.get(id)?.unmount();
    }

    this.children.set(id, child);

    const container = containerSelector ? this.element.querySelector(containerSelector) as HTMLElement : this.element;
    if (container) {
      child.mount(container);
    } else {
      console.warn(`[UIComponent] Container ${containerSelector} not found in ${this.constructor.name}`);
    }
  }
}
