import { useState } from 'react';
import { useAdminLeaveWarning } from './navigation';

/** Last table row: a dashed input that stages a new row on Enter. */
export function RosterQuickAdd({
  kind,
  label,
  prompt,
  disabled,
  add,
}: {
  kind: 'jurors' | 'teams';
  label: string;
  prompt: string;
  disabled: boolean;
  add: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  useAdminLeaveWarning(Boolean(value.trim()));
  return (
    <tr className="roster-add-row" data-kind={kind}>
      <td aria-hidden="true">+</td>
      <td colSpan={3}>
        <input
          id={`${kind}-add`}
          aria-label={label}
          placeholder={prompt}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            if (value.trim()) {
              add(value);
              setValue('');
            }
          }}
        />
      </td>
    </tr>
  );
}
