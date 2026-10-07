import type { NucleationContact } from '../types';
import { entitySlug, findBySlug } from './entitySlug';

export const NUCLEATION_BASE = '/nucleacao';

type ContactLike = Pick<NucleationContact, 'id' | 'name'>;
const bases = (contact: ContactLike) => [contact.name];

export const contactSlug = (contact: ContactLike, contacts: ContactLike[]) => entitySlug(contact, contacts, bases);
export const findContact = <T extends ContactLike>(contacts: T[], param?: string) => findBySlug(contacts, param, bases);
export const contactPath = (contact: ContactLike, contacts: ContactLike[]) => `${NUCLEATION_BASE}/${contactSlug(contact, contacts)}`;
