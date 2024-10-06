import type { Modding } from "@flamework/core";
import type { Entity } from "@rbxts/jecs";
import * as ecs from "@rbxts/jecs";

import type { Signal } from "./signal";
import { createSignal } from "./signal";

export const registry = new ecs.World();
export const signals: {
	added: Record<Id<unknown>, Signal<[number]>>;
	changed: Record<Id<unknown>, Signal<[number, unknown]>>;
	removed: Record<Id<unknown>, Signal<[number]>>;
} = {
	added: {},
	changed: {},
	removed: {},
};

export function added<T>(id: Id<T>): Signal<[number]> {
	return signals.added[id]!;
}

export function removed<T>(id: Id<T>): Signal<[number]> {
	return signals.removed[id]!;
}

const idToKey = new Map<number, string>();

export type Id<T = undefined> = {
	__T: T;
} & number;

export interface Tag {
	type: "FLAMECS_TAG";
}

export interface Relation<T = Tag> {
	type: "FLAMECS_RELATION";
	value: T;
}

const components = new Map<string, Id<unknown>>();

/**
 * A component is something that is added to an entity. Components can simply
 * tag an entity ("this entity is an Npc"), attach data to an entity ("this
 * entity is at Position Vector3.new(10, 20, 30)") and create relationships
 * between entities ("bob Likes alice") that may also contain data ("bob Eats 10
 * apples").
 *
 * @template T - The type of the component.
 * @param key - Flamework autogenerated key.
 * @returns The component entity id.
 * @metadata macro
 */
export function component<T>(key?: Modding.Generic<T, "id">): Id<T> {
	assert(key);
	let id = components.get(key) as Id<T> | undefined;
	if (id === undefined) {
		id = registry.component();
		components.set(key, id);
		idToKey.set(id, key);
		const addedSignal = createSignal<[number]>();
		const removedSignal = createSignal<[number]>();
		const changedSignal = createSignal<[number, T]>();
		signals.added[id] = addedSignal;
		signals.removed[id] = removedSignal;
		signals.changed[id] = changedSignal as never;

		registry.set(id, ecs.OnAdd, entity => {
			addedSignal.fire(entity);
		});
		registry.set(id, ecs.OnRemove, entity => {
			removedSignal.fire(entity);
		});
		registry.set(id, ecs.OnSet, (entity, data) => {
			changedSignal.fire(entity, data as T);
		});
	}

	return id;
}

/**
 * Adds or changes the entity's component.
 *
 * @template T - The type of the component.
 * @param entity - The entity to modify.
 * @param value - The data of the component's type.
 * @param key - Flamework autogenerated key.
 * @metadata macro
 */
export function set<T>(entity: number, value: T, key?: Modding.Generic<T, "id">): void {
	const id = component(key);
	registry.set(entity as Entity, id, value);
}

/**
 * Adds or changes the entity's components.
 *
 * @template T - The type of the component.
 * @param entity - The entity to modify.
 * @param values - The component values.
 * @param keys - Flamework autogenerated keys.
 * @metadata macro
 */
export function insert<T extends Array<unknown>>(
	entity: number,
	values: T,
	keys?: Modding.Many<{ [K in keyof T]: Modding.Generic<T[K], "id"> }>,
): void {
	assert(keys);
	for (const key of keys) {
		const id = component(key);
		registry.set(entity as Entity, id, values);
	}
}

/**
 * Adds a component ID to the entity.
 *
 * This operation adds a single (component) id to an entity.
 *
 * @template T - The type of the component.
 * @param entity - The entity to add the component to.
 * @param key - Flamework autogenerated key.
 * @info This function is idempotent, meaning if the entity already has the id, this operation will have no side effects.
 * @metadata macro
 */
export function add<T>(entity: number, key?: Modding.Generic<T, "id">): void {
	const id = component(key);
	registry.add(entity as Entity, id);
}

/**
 * Removes the component ID from the entity.
 *
 * @template T - The type of the component.
 * @param entity - The entity to remove the component from.
 * @param key - Flamework autogenerated key.
 * @metadata macro
 */
export function remove<T>(entity: number, key?: Modding.Generic<T, "id">): void {
	const id = component(key);
	registry.remove(entity as Entity, id);
}

/**
 * Returns the data for the component data the corresponding entity, nil if
 * entity does not have the ID or was a tag.
 *
 * @template T - The type of the component.
 * @param entity - The entity to get the component data for.
 * @param key - Flamework autogenerated key.
 * @returns Returns the data for the component data the corresponding entity,
 *   nil if entity does not have the id or was a tag.
 * @metadata macro
 */
export function get<T>(entity: number, key?: Modding.Generic<T, "id">): T | undefined {
	const id = component(key);
	return registry.get(entity as Entity, id);
}

/**
 * Returns whether the entity has the given id.
 *
 * @template T - The type of the component.
 * @param entity - The entity to check.
 * @param key - Flamework autogenerated key.
 * @returns Whether the entity has the id.
 * @metadata macro
 */
export function has<T>(entity: number, key?: Modding.Generic<T, "id">): boolean {
	const id = component(key);
	return registry.has(entity as Entity, id);
}

/**
 * Creates a new entity with the specified components.
 *
 * @template T - The type of the components.
 * @param bundle - The components to add to the entity.
 * @param keys - Flamework autogenerated keys.
 * @returns The entity id.
 * @metadata macro
 */
export function spawn<const T extends Array<unknown>>(
	bundle?: T,
	keys?: Array<unknown> extends T
		? undefined
		: Modding.Many<{ [K in keyof T]: Modding.Generic<T[K], "id"> }>,
): number {
	const entity = registry.entity();
	if (keys && bundle) {
		const size = bundle.size();
		for (const index of $range(0, size - 1)) {
			const key = keys[index];
			const data = bundle[index];
			const id = component(key);
			registry.set(entity, id, data);
		}
	}

	return entity;
}

export function despawn(entity: number): void {
	registry.delete(entity as never);
}
