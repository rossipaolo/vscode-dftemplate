/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

/**
 * Specifications of an action.
 */
export interface ActionDetails {
    
    /**
     * A short description for this action.
     */
    summary: string;

    /**
     * All variations of this action.
     */
    overloads: string[];
}

/**
 * An action imported from a module.
 */
export interface ActionInfo {

    /**
     * The name of the module that owns this action.
     */
    moduleName: string;

    /**
     * The kind of action.
     */
    actionKind: string;

    /**
     * Specifications of this action.
     */
    details: ActionDetails;

    /**
     * Index of the used signature variation.
     */
    overload: number;
}