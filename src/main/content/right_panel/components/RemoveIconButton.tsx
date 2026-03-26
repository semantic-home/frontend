import {Trash2} from "lucide-react";
import buttonStyles from "../../../../styles/Button.module.css";
import iconStyles from "../../../../styles/Icon.module.css";
import {joinClassNames} from "../../../../utils/classNames.ts";
import styles from "./RemoveIconButton.module.css";

type RemoveIconButtonProps = {
    ariaLabel: string
    title?: string
    disabled?: boolean
    className?: string
    onClick: () => void
}

export function RemoveIconButton(
    {
        ariaLabel,
        title = "Remove",
        disabled = false,
        className,
        onClick,
    }: RemoveIconButtonProps,
) {
    return (
        <button
            type="button"
            className={joinClassNames(buttonStyles.button, styles.button, className)}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            title={title}
        >
            <Trash2 className={joinClassNames(iconStyles.icon, styles.icon)} aria-hidden="true"/>
        </button>
    )
}
