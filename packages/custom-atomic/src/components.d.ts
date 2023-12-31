/* eslint-disable */
/* tslint:disable */
/**
 * This is an autogenerated file created by the Stencil compiler.
 * It contains typing information for all components that exist in this project.
 */
import { HTMLStencilElement, JSXBase } from "@stencil/core/internal";
export namespace Components {
    interface AtomicCustomTab {
        "excludedFacets": string;
        "expression": string;
        "fullFacetList": string;
        "isActive": boolean;
        "label": string;
    }
}
declare global {
    interface HTMLAtomicCustomTabElement extends Components.AtomicCustomTab, HTMLStencilElement {
    }
    var HTMLAtomicCustomTabElement: {
        prototype: HTMLAtomicCustomTabElement;
        new (): HTMLAtomicCustomTabElement;
    };
    interface HTMLElementTagNameMap {
        "atomic-custom-tab": HTMLAtomicCustomTabElement;
    }
}
declare namespace LocalJSX {
    interface AtomicCustomTab {
        "excludedFacets": string;
        "expression": string;
        "fullFacetList": string;
        "isActive": boolean;
        "label": string;
    }
    interface IntrinsicElements {
        "atomic-custom-tab": AtomicCustomTab;
    }
}
export { LocalJSX as JSX };
declare module "@stencil/core" {
    export namespace JSX {
        interface IntrinsicElements {
            "atomic-custom-tab": LocalJSX.AtomicCustomTab & JSXBase.HTMLAttributes<HTMLAtomicCustomTabElement>;
        }
    }
}
