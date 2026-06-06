/**
 * @ Author: BetterInternship
 * @ Create Time: 2025-11-09 03:19:04
 * @ Modified time: 2026-01-03 14:38:37
 * @ Description:
 *
 * We can move this out later on so it becomes reusable in other places.
 * This allows the consumer to use information about a form within the component.
 * This is the form context used by a form renderer.
 */

import {
  ClientField,
  ClientPhantomField,
  ServerField,
  FormMetadata,
  IFormMetadata,
  IFormParameters,
  ClientBlock,
} from "@betterinternship/core/forms";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formsControllerGetLatestFormDocumentAndMetadata } from "@/app/api";

// ? Current schema version, update if needed; tells us if out of date
export const SCHEMA_VERSION = 1;

// Context interface
export interface IFormRendererContext<T extends any[]> {
  formName: string;
  formLabel: string;
  formVersion: number;
  formMetadata: FormMetadata<T>;
  document: IDocument;
  fields: (ClientField<T> | ClientPhantomField<T>)[];
  blocks: ClientBlock<T>[];
  params: IFormParameters;
  keyedFields: (ServerField & { _id: string })[];
  previews: Record<number, React.ReactNode[]>;
  loading: boolean;
  selectedPreviewId: string | null;
  setSelectedPreviewId: (id: string | null) => void;

  // Setters
  updateFormName: (newFormName: string) => void;
  updateSigningPartyId: (signingPartyId: string) => void;
  refreshPreviews: () => void;
}

interface IDocument {
  name: string;
  url: string;
}

// Context defs
export const FormRendererContext = createContext<IFormRendererContext<[any]>>(
  {} as IFormRendererContext<[any]>
);
export const useFormRendererContext = () => useContext(FormRendererContext);

/**
 * Gives access to form context api
 *
 * @component
 * @provider
 */
export const FormRendererContextProvider = ({ children }: { children: React.ReactNode }) => {
  // Default form metadata
  const initialFormMetadata: IFormMetadata = {
    name: "",
    label: "",
    schema_version: SCHEMA_VERSION,
    schema: { blocks: [] },
    subscribers: [],
    signing_parties: [],
  };

  const [formMetadata, setFormMetadata] = useState<FormMetadata<[any]>>(
    new FormMetadata(initialFormMetadata)
  );
  const [documentName, setDocumentName] = useState<string>("");
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [formName, setFormName] = useState<string>("");
  const [formLabel, setFormLabel] = useState<string>("");
  const [signingPartyId, setSigningPartyId] = useState<string>("initiator");
  const [formVersion, setFormVersion] = useState<number>(0);
  const [previewFields, setPreviewFields] = useState<ServerField[]>([]);
  const [blocks, setBlocks] = useState<ClientBlock<[any]>[]>([]);
  const [fields, setFields] = useState<ClientField<[any]>[]>([]);
  const [params, setParams] = useState<IFormParameters>({});
  const [previews, setPreviews] = useState<Record<number, React.ReactNode[]>>({});
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>("");

  // Used in the ui for selecting / distinguishing fields
  const keyedFields = useMemo(
    () =>
      previewFields.map((field) => ({
        _id: Math.random().toString(),
        ...field,
      })),
    [previewFields]
  );

  // Loading states
  const [loading, setLoading] = useState(true);

  // Refresh previews of the different fields
  const refreshPreviews = () => {
    const newPreviews: Record<number, React.ReactNode[]> = {};

    // Push new previews here
    keyedFields.forEach((field) => {
      if (!newPreviews[field.page]) newPreviews[field.page] = [];
      newPreviews[field.page].push(
        <FieldPreview
          key={field._id}
          field={field.field}
          x={field.x}
          y={field.y}
          w={field.w}
          h={field.h}
          selected={field._id === selectedPreviewId}
          onClick={() => setSelectedPreviewId(field._id)}
        />
      );
    });

    setPreviews(newPreviews);
  };

  // When form name and version are updated, pull latest
  useEffect(() => {
    if (!formName || (!formVersion && formVersion !== 0)) return;
    let timeout: NodeJS.Timeout;
    const controller = new AbortController();

    formsControllerGetLatestFormDocumentAndMetadata({ name: formName })
      .then((form) => {
        const fm = new FormMetadata(form.formMetadata as unknown as IFormMetadata);
        const newFormName = form.formMetadata.name;
        const newFormVersion = form.formTemplate.version

        // Only update form if it's new
        setFormMetadata(fm);
        setFormName(newFormName);
        setFormLabel(form.formMetadata.label);
        setFormVersion(newFormVersion);
        setDocumentName(form.formTemplate.name);
        setDocumentUrl(form.documentUrl);
        setFields(fm.getFieldsForClientService(signingPartyId));
        setBlocks(fm.getBlocksForClientService(signingPartyId));
        setPreviewFields(fm.getFieldsForSigningService());
      })
      .then(() => (timeout = setTimeout(() => setLoading(false), 1000)))
      .catch((e) => {
        console.error(e);
        timeout = setTimeout(() => setLoading(false), 1000);
      });

    setLoading(true);
    return () => {
      if (timeout) clearTimeout(timeout);
      controller.abort();
    };
  }, [formName, formVersion, signingPartyId]);

  // Clear fields on refresh?
  useEffect(() => {
    setFields([]);
    setParams({});
    setFormMetadata(new FormMetadata(initialFormMetadata));
  }, []);

  // Updates the field previews
  // (we have to touch the DOM directly for this to go under the hoods of the lib we're using)
  useEffect(() => {
    // Refresh previews
    refreshPreviews();

    return () => setPreviews({});
  }, [selectedPreviewId, keyedFields]);

  // The form context
  const formContext: IFormRendererContext<[any]> = {
    formName,
    formLabel,
    formVersion,
    formMetadata,
    fields,
    blocks,
    params,
    keyedFields,
    previews,
    loading,
    selectedPreviewId: selectedPreviewId || null,
    setSelectedPreviewId: (id: string | null) => setSelectedPreviewId(id ?? ""),
    document: { name: documentName, url: documentUrl },
    updateFormName: (newFormName: string) => setFormName(newFormName),
    updateSigningPartyId: (signingPartyId: string) => setSigningPartyId(signingPartyId),
    refreshPreviews: refreshPreviews,
  };

  return (
    <FormRendererContext.Provider value={formContext}>{children}</FormRendererContext.Provider>
  );
};

/**
 * Prop-driven context provider for the editor's form preview. Provides the
 * same FormRendererContext shape as FormRendererContextProvider but derives
 * blocks/fields from props instead of API fetches, so the editor preview and
 * the sign route both run through the same context interface.
 */
export const StaticFormRendererContextProvider = ({
  children,
  formName,
  formLabel,
  formMetadata: rawMetadata,
  signingPartyId,
  selectedPreviewId,
  onSelectedPreviewId,
}: {
  children: React.ReactNode;
  formName: string;
  formLabel: string;
  formMetadata: IFormMetadata;
  signingPartyId: string;
  selectedPreviewId: string | null;
  onSelectedPreviewId: (id: string | null) => void;
}) => {
  const metadataClient = useMemo(() => {
    try {
      return new FormMetadata(rawMetadata);
    } catch {
      return null;
    }
  }, [rawMetadata]);

  const blocks = useMemo(
    () =>
      metadataClient
        ? (metadataClient.getBlocksForClientService(signingPartyId) as ClientBlock<[any]>[])
        : [],
    [metadataClient, signingPartyId]
  );

  const fields = useMemo(
    () => (metadataClient ? metadataClient.getFieldsForClientService(signingPartyId) : []),
    [metadataClient, signingPartyId]
  );

  const value: IFormRendererContext<[any]> = {
    formName,
    formLabel,
    formVersion: 0,
    formMetadata: metadataClient as unknown as FormMetadata<[any]>,
    fields,
    blocks,
    params: {},
    keyedFields: [],
    previews: {},
    loading: false,
    selectedPreviewId,
    setSelectedPreviewId: onSelectedPreviewId,
    document: { name: "", url: "" },
    updateFormName: () => {},
    updateSigningPartyId: () => {},
    refreshPreviews: () => {},
  };

  return <FormRendererContext.Provider value={value}>{children}</FormRendererContext.Provider>;
};

/**
 * A preview of what the field will look like on the document.
 *
 * @component
 */
export const FieldPreview = ({
  field,
  value,
  x,
  y,
  w,
  h,
  selected,
  onClick,
}: {
  field: string;
  value?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  selected: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 border-0!",
        selected ? "bg-supportive/50!" : "bg-warning/50!"
      )}
      onClick={() => onClick?.()}
      onMouseDown={() => onClick?.()}
      style={{
        userSelect: "auto",
        display: "inline-block",
        width: `round(var(--scale-factor) * ${w}px, 1px)`,
        height: `round(var(--scale-factor) * ${h}px, 1px)`,
        fontSize: "10px",
        transform: `translate(round(var(--scale-factor) * ${x}px, 1px), round(var(--scale-factor) * ${y}px, 1px))`,
        boxSizing: "border-box",
        cursor: "pointer",
        flexShrink: "0",
      }}
    >
      {value ?? field}
    </div>
  );
};
