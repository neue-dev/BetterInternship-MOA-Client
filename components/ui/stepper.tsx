import { ChevronRight, CircleCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  title: string;
}

export const Stepper = ({
  steps,
  currentStep,
  stepNumberOffset = 0,
  className,
}: {
  steps: StepperStep[];
  currentStep: number;
  stepNumberOffset?: number;
  className?: string;
}) => {
  return (
    <nav
      aria-label="Form progress"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-2", className)}
    >
      {steps.map((step, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;

        return (
          <div key={step.title} className="flex items-center gap-2">
            <div
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-xs font-medium sm:text-sm",
                active ? "text-primary" : complete ? "text-supportive" : "text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {complete ? (
                <CircleCheckBig
                  className="text-supportive h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <span className="mt-0.5">{index + stepNumberOffset + 1}</span>
                </span>
              )}
              <span className="truncate">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight
                className="text-muted-foreground h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
};
