import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HOLD_DELAY_MS, RowName } from './RowName';

describe('RowName', () => {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  function setup() {
    const onPress = vi.fn();
    const onHold = vi.fn();
    const onOpenMenu = vi.fn();
    render(
      <RowName
        name="Deutes"
        width="35vw"
        onPress={onPress}
        onHold={onHold}
        onOpenMenu={onOpenMenu}
        menuLabel="Abrir el menú del grupo Deutes"
      />,
    );
    const user = userEvent.setup();
    return { user, onPress, onHold, onOpenMenu };
  }

  it('un toque corto llama a onPress y no abre el menú', async () => {
    const { user, onPress, onHold } = setup();
    const name = screen.getByRole('button', { name: 'Deutes' });

    await user.pointer({ keys: '[TouchA>]', target: name });
    await wait(HOLD_DELAY_MS / 4);
    await user.pointer({ keys: '[/TouchA]', target: name });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onHold).not.toHaveBeenCalled();
  });

  it('mantener pulsado llama a onHold y anula el toque', async () => {
    const { user, onPress, onHold } = setup();
    const name = screen.getByRole('button', { name: 'Deutes' });

    await user.pointer({ keys: '[TouchA>]', target: name });
    await wait(HOLD_DELAY_MS + 100);
    expect(onHold).toHaveBeenCalledTimes(1);
    await user.pointer({ keys: '[/TouchA]', target: name });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('el icono ⋮ abre el menú', async () => {
    const { user, onOpenMenu, onPress } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Abrir el menú del grupo Deutes' }),
    );
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
