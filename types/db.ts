// lib/types/db.ts
import { DocumentTables, EntityTables, SchoolTables } from "@betterinternship/schema";

// ---------- Shared ----------
export type UUID = string; // randomUUID
export type ISODate = string; // ISO timestamp
export type URLString = string;

export type DocumentType = "BIR registration" | "SEC registration" | "Business Permit" | "Other";

export type RequestResult = "approved" | "denied" | "continuedDialogue";
export type SourceType = "school" | "entity";

// ---------- MOA SIDE ----------
export type EntityDocument = {
  documentType: DocumentType;
  url: URLString;
};

export type Entity = EntityTables<"entities">;
export type MoaRequest = EntityTables<"moa_requests">;
export interface NewEntityRequet extends EntityTables<"new_entity_requests"> {
  entities?: Entity;
}
export type EntityLog = EntityTables<"entity_logs">;
export type Thread = EntityTables<"threads">;
export type Message = EntityTables<"messages">;

// ---------- UNIV SIDE ----------
export type MoaHistory = SchoolTables<"moa_histories">;
export type School = SchoolTables<"schools">;
export type SchoolAccount = SchoolTables<"school_accounts">;

export type SchoolLog = {
  actionBy: UUID; // accountId
  actionType: string;
  entity_id: UUID;
  datetime: ISODate;
};

export type SchoolEntity = {
  id: UUID;
  entityId: UUID;
  schoolID: UUID;
  status: "registered" | "approved" | "blacklisted";
};

export type PrivateNote = {
  id: UUID;
  authorId: UUID; // account id
  entityId: UUID;
  message: string;
  timestamp: ISODate;
};

// ---------- DOCUMENT STORAGE ----------
export type BaseDocument = {
  uid: UUID;
  url: URLString;
};

export type BaseImage = {
  uid: UUID;
  file_name: string;
  source_text?: string;
  url: URLString;
};

export type SignedDocumentParty = { name: string; email?: string };

export type SignedDocument = DocumentTables<"signed_documents">;
