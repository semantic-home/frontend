import {type ReactNode, useEffect, useRef, useState} from "react";
import styles from "./AttachedPopover.module.css";
import {joinClassNames} from "../../../../utils/classNames.ts";


type AttachedPopoverProps = {
    trigger: ReactNode
    children: ReactNode
    dialogAriaLabel: string
    triggerClassName?: string
    anchorClassName?: string
    popoverClassName?: string
    arrowClassName?: string
    showArrow?: boolean
    placement?: "bottom" | "top"
}


export function AttachedPopover({
    trigger,
    children,
    dialogAriaLabel,
    triggerClassName,
    anchorClassName,
    popoverClassName,
    arrowClassName,
    showArrow = true,
    placement = "bottom",
}: AttachedPopoverProps) {
    const [isOpen, setIsOpen] = useState(false)
    const anchorRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isOpen) {
            return
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!anchorRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.key !== "Escape") {
                return
            }

            setIsOpen(false)
            event.preventDefault()
        }

        document.addEventListener("pointerdown", handlePointerDown)
        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown)
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen])

    return (
        <div ref={anchorRef} className={joinClassNames(styles.anchor, anchorClassName)}>
            <button
                type="button"
                className={joinClassNames(styles.trigger, triggerClassName)}
                onClick={() => setIsOpen((currentOpen) => !currentOpen)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                {trigger}
            </button>

            {isOpen && (
                <div
                    className={joinClassNames(styles.popover, popoverClassName)}
                    data-placement={placement}
                    role="dialog"
                    aria-label={dialogAriaLabel}
                >
                    {showArrow && (
                        <div className={joinClassNames(styles.arrow, arrowClassName)} aria-hidden="true"/>
                    )}
                    {children}
                </div>
            )}
        </div>
    )
}
