"use client";

import { useRequestThread } from "@/app/api/entity.api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validate } from "uuid";
import { Loader } from "@/components/ui/loader";
import {
  AreaHighlight,
  Comment,
  Content,
  Highlight,
  IHighlight,
  NewHighlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
  ScaledPosition,
} from "react-pdf-highlighter";
import "./react-pdf-highlighter.css";
import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
import { PDFDocument } from "pdf-lib";
import { Divider } from "@/components/ui/divider";
import { useMoaRequests } from "@/app/api/school.api";

// ! replace or make standardized
const signatoryOptions = [
  { id: "school_signatory_name", name: "Signatory name" },
  { id: "school_signatory_signature", name: "Signatory signature" },
  { id: "school_signatory_title", name: "Signatory title" },
];

const parseIdFromHash = () => document.location.hash.slice("#highlight-".length);

export function MoaSigningPage() {
  const params = useSearchParams();
  const requestId = params.get("request-id");
  const threadId = params.get("thread-id");
  const router = useRouter();
  const requestThread = useRequestThread(threadId);
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
  const [selectedHighlightType, setSelectedHighlightType] = useState<string | null>(null);

  const resetHighlights = () => {
    setHighlights([]);
  };

  const scrollViewerTo = useRef((highlight: IHighlight) => {});
  const getNextId = () => String(Math.random()).slice(2);
  const getHighlightById = (id: string) => {
    return highlights.find((highlight) => highlight.id === id);
  };
  const addHighlight = (highlight: NewHighlight) => {
    // console.log("Saving highlight", highlight);
    setHighlights((prevHighlights) => [{ ...highlight, id: getNextId() }, ...prevHighlights]);
  };

  const updateHighlight = (
    highlightId: string,
    position: Partial<ScaledPosition>,
    content: Partial<Content>
  ) => {
    // console.log("Updating highlight", highlightId, position, content);
    setHighlights((prevHighlights) =>
      prevHighlights.map((h) => {
        const { id, position: originalPosition, content: originalContent, ...rest } = h;
        return id === highlightId
          ? {
              id,
              position: { ...originalPosition, ...position },
              content: { ...originalContent, ...content },
              ...rest,
            }
          : h;
      })
    );
  };

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = getHighlightById(parseIdFromHash());
    if (highlight) {
      scrollViewerTo.current(highlight);
    }
  }, []);

  if (requestThread.isLoadingLatestDocument) return <Loader />;
  if (!threadId || !validate(threadId) || !requestId || !validate(requestId))
    return router.push("/dashboard");

  return (
    <div className="relative h-[720px] w-1/2 p-5">
      <div className="absolute flex h-full w-full flex-row gap-2">
        <Sidebar
          requestId={requestId}
          highlights={highlights}
          selectedHighlightType={selectedHighlightType}
          setHighlightType={setSelectedHighlightType}
          removeHighlight={(highlight: IHighlight) => {
            setHighlights(highlights.filter((h) => h.id !== highlight.id));
          }}
          latestDocumentUrl={requestThread.latestDocument?.document_url}
          reset={resetHighlights}
        />
        <PdfLoader url={requestThread.latestDocument?.document_url ?? ""} beforeLoad={<Loader />}>
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              enableAreaSelection={(event) => {
                if (selectedHighlightType) {
                  setTimeout(() => {
                    event.target?.dispatchEvent(
                      new MouseEvent("mouseup", {
                        ...event,
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                    event.target?.dispatchEvent(
                      new MouseEvent("mousedown", {
                        ...event,
                        bubbles: true,
                        cancelable: true,
                      })
                    );
                  });
                  setTimeout(() => {
                    const draggables = document.querySelectorAll(".react-draggable");
                    // console.log(draggables);
                    draggables.forEach((draggable) => {
                      draggable.dispatchEvent(
                        new MouseEvent("mousedown", {
                          ...event,
                          bubbles: true,
                          cancelable: true,
                        })
                      );
                      draggable.dispatchEvent(
                        new MouseEvent("mouseup", {
                          ...event,
                          bubbles: true,
                          cancelable: true,
                        })
                      );
                    });
                  }, 100);
                  return true;
                }
                return false;
              }}
              onScrollChange={() => (document.location.hash = "")}
              scrollRef={(scrollTo) => {
                scrollViewerTo.current = scrollTo as (highlight: IHighlight) => void;
                scrollToHighlightFromHash();
              }}
              onSelectionFinished={(
                position,
                content,
                hideDropdownAndSelection,
                transformSelection
              ) => {
                position.boundingRect.x1 = position.boundingRect.x2 - 96;
                position.boundingRect.y1 = position.boundingRect.y2 - 9;
                position.boundingRect.x2 = position.boundingRect.x2 + 96;
                position.boundingRect.y2 = position.boundingRect.y2 + 9;

                addHighlight({
                  content,
                  position,
                  comment: { text: selectedHighlightType, emoji: "" } as unknown as Comment,
                });

                hideDropdownAndSelection();
                setSelectedHighlightType(null);

                return <div></div>;
              }}
              highlightTransform={(
                highlight,
                index,
                setTip,
                hideTip,
                viewportToScaled,
                screenshot,
                isScrolledTo
              ) => {
                const isTextHighlight = !highlight.content?.image;

                const component = isTextHighlight ? (
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                    comment={highlight.comment}
                  />
                ) : (
                  <AreaHighlight
                    isScrolledTo={isScrolledTo}
                    highlight={highlight}
                    onChange={(boundingRect) => {
                      updateHighlight(
                        highlight.id,
                        { boundingRect: viewportToScaled(boundingRect) },
                        { image: screenshot(boundingRect) }
                      );
                    }}
                  />
                );

                return (
                  <Popup
                    popupContent={<HighlightPopup {...highlight} />}
                    onMouseOver={(popupContent) => setTip(highlight, (highlight) => popupContent)}
                    onMouseOut={hideTip}
                    key={index}
                  >
                    {component}
                  </Popup>
                );
              }}
              highlights={highlights}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
}

function AreaDropdown({
  options,
  onSelect,
}: {
  options: { id: string; name: string }[];
  onSelect: (id?: string | null) => void;
}) {
  return (
    <div className="rounded-[0.33em] border border-gray-200 bg-white p-3">
      <span>What information should go here?</span>
      <div className="border-gray-200">
        <Autocomplete
          placeholder="Type here..."
          options={options}
          setter={(id?: string | null) =>
            options.some((option) => option.id === id) && onSelect(id)
          }
        ></Autocomplete>
      </div>
    </div>
  );
}

function Sidebar({
  requestId,
  highlights,
  selectedHighlightType,
  setHighlightType,
  removeHighlight,
  latestDocumentUrl,
  reset,
}: {
  requestId: string;
  highlights: Array<IHighlight>;
  selectedHighlightType: string | null;
  setHighlightType: (highlightType: string) => void;
  removeHighlight: (highlight: IHighlight) => void;
  latestDocumentUrl?: string | null;
  reset: () => void;
}) {
  const moaRequests = useMoaRequests();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const request = useMemo(
    () => moaRequests.requests.find((r) => r.id === requestId) ?? null,
    [moaRequests, requestId]
  );

  useEffect(() => {
    async function fetchPdf() {
      if (!latestDocumentUrl) return;
      const res = await fetch(latestDocumentUrl);
      const arrayBuffer = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const firstPage = pdfDoc.getPages()[0];
      const width = firstPage.getWidth();
      setWidth(width);
    }
    fetchPdf().catch(console.error);
  }, [latestDocumentUrl]);

  if (!request?.entity_id) return <Loader></Loader>;

  return (
    <div className="sidebar" style={{ width: "25vw" }}>
      <div className="description" style={{ padding: "1rem" }}>
        <h1 className="text-2xl font-bold tracking-tight">Select Signing Areas</h1>
      </div>

      <ul className="sidebar__highlights">
        {highlights.map((highlight: IHighlight, index: number) => (
          <li
            key={index}
            className="sidebar__highlight"
            onClick={() => (document.location.hash = "")}
          >
            <div>
              <strong>{highlight.comment.text}</strong>
              {/* {highlight.content.text ? (
                <blockquote style={{ marginTop: "0.5rem" }}>
                  {`${highlight.content.text.slice(0, 90).trim()}...`}
                </blockquote>
              ) : null}
              {highlight.content.image ? (
                <div className="highlight__image" style={{ marginTop: "0.5rem" }}>
                  <img src={highlight.content.image} alt={"Screenshot"} />
                </div>
              ) : null} */}
            </div>
            <div className="mt-2 flex flex-row justify-between">
              <Button
                scheme="destructive"
                size="xs"
                className="text-right"
                onClick={() => removeHighlight(highlight)}
              >
                remove
              </Button>
              <div className="highlight__location">Page {highlight.position.pageNumber}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 p-[1rem]">
        {!!selectedHighlightType && (
          <span className="text-primary bg-primary/10 rounded-[0.33em] p-2 px-4 tracking-tight">
            Click and drag to select an area on the pdf to place the field.
          </span>
        )}
        <Button
          variant="outline"
          scheme="secondary"
          disabled={!!selectedHighlightType}
          onClick={() => setHighlightType("school_signatory_name")}
        >
          Place Signatory Name
        </Button>
        <Button
          variant="outline"
          scheme="secondary"
          disabled={!!selectedHighlightType}
          onClick={() => setHighlightType("school_signatory_title")}
        >
          Place Signatory Title
        </Button>
        <Button
          variant="outline"
          scheme="secondary"
          disabled={!!selectedHighlightType}
          onClick={() => setHighlightType("school_signatory_signature")}
        >
          Place Signatory Signature
        </Button>
        <div className="p-2">
          <Divider />
        </div>
        {highlights.length > 0 ? (
          <>
            <Button scheme="destructive" onClick={reset}>
              Clear Selections
            </Button>
            <Button
              scheme="primary"
              disabled={loading}
              onClick={() => {
                const formSchema: any[] = [];
                highlights.forEach((highlight) => {
                  setLoading(true);
                  const scale = width / highlight.position.boundingRect.width;
                  const x = highlight.position.boundingRect.x1 * scale;
                  const y = highlight.position.boundingRect.y1 * scale;
                  const w = highlight.position.boundingRect.x2 * scale - x;
                  const h = highlight.position.boundingRect.y2 * scale - y;

                  formSchema.push({
                    field: highlight.comment.text,
                    value: "test value for " + highlight.comment.text,
                    type: "text", // ! change
                    x: Math.round(x),
                    y: Math.round(y),
                    w: Math.round(w),
                    h: Math.round(h),
                    page: highlight.position.pageNumber,
                  });
                });
                moaRequests
                  .sign({
                    entity_id: request?.entity_id,
                    request_id: requestId,
                    additional_form_schema: formSchema,
                  })
                  .then(
                    () => (
                      alert("Successfully signed MOA."),
                      router.push("/moa-approval"),
                      setLoading(false)
                    )
                  )
                  .catch(() => (alert("Something went wrong."), setLoading(false)));
              }}
            >
              {loading ? "Submitting..." : "Sign and Submit"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

const HighlightPopup = ({ comment }: { comment: { text: string; emoji: string } }) =>
  comment.text ? (
    <div className="Highlight__popup">
      {comment.emoji} {comment.text}
    </div>
  ) : null;

export default MoaSigningPage;
