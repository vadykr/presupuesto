// @ts-strict-ignore
import React, { useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgChartPie,
  SvgDotsHorizontalTriple,
  SvgPin,
  SvgTarget,
  SvgTrash,
} from '@actual-app/components/icons/v1';
import {
  SvgNotesPaper,
  SvgViewHide,
  SvgViewShow,
} from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { Template } from '@actual-app/core/types/models/templates';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { useResumenObjetivo } from '#components/mobile/budget/ObjetivoPage';
import {
  notaSinObjetivo,
  objetivoDesdePlantillas,
} from '#components/mobile/budget/objetivos';
import { Notes } from '#components/Notes';
import { useCategory } from '#hooks/useCategory';
import { useCategoryGroup } from '#hooks/useCategoryGroup';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useNavigate } from '#hooks/useNavigate';
import { useNotes } from '#hooks/useNotes';
import { usePinnedCategories } from '#hooks/usePinnedCategories';
import type { Modal as ModalType } from '#modals/modalsSlice';

type CategoryMenuModalProps = Extract<
  ModalType,
  { name: 'category-menu' }
>['options'];

export function CategoryMenuModal({
  categoryId,
  month,
  onSave,
  onEditNotes,
  onDelete,
  onToggleVisibility,
  onEditAutomations,
  onClose,
}: CategoryMenuModalProps) {
  const { t } = useTranslation();
  const { data: category } = useCategory(categoryId);
  const { data: categoryGroup } = useCategoryGroup(category?.group);
  const originalNotes = useNotes(category.id);
  // Sin las líneas «#template…»: el objetivo ya sale en su botón.
  const notasVisibles = notaSinObjetivo(originalNotes);
  const { isPinned, togglePinned } = usePinnedCategories();
  const pinned = isPinned(categoryId);
  const navigate = useNavigate();
  const goalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const resumenObjetivo = useResumenObjetivo();

  // Resumen del objetivo actual («50,52 € al mes») a partir de goal_def y
  // la marca de la nota; ver mobile/budget/objetivos.ts.
  const objetivo = useMemo(() => {
    if (!category?.goal_def) {
      return null;
    }
    try {
      const templates = JSON.parse(category.goal_def) as Template[];
      return objetivoDesdePlantillas(templates, originalNotes);
    } catch {
      return 'otro' as const;
    }
  }, [category?.goal_def, originalNotes]);

  const onRename = newName => {
    if (newName && newName !== category.name) {
      onSave?.({
        ...category,
        name: newName,
      });
    }
  };

  const _onToggleVisibility = () => {
    onToggleVisibility?.(category.id);
  };

  const _onEditNotes = () => {
    onEditNotes?.(category.id);
  };

  const _onDelete = () => {
    onDelete?.(category.id);
  };

  const _onEditAutomations = () => {
    onEditAutomations?.(category.id);
  };

  const buttonStyle: CSSProperties = {
    ...styles.mediumText,
    height: styles.mobileMinHeight,
    color: theme.formLabelText,
    // Adjust based on desired number of buttons per row.
    flexBasis: '100%',
  };

  return (
    <Modal
      name="category-menu"
      onClose={onClose}
      containerProps={{
        style: { height: '45vh' },
      }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            leftContent={
              <AdditionalCategoryMenu
                category={category}
                categoryGroup={categoryGroup}
                onDelete={_onDelete}
                onToggleVisibility={_onToggleVisibility}
              />
            }
            title={
              <ModalTitle
                isEditable
                title={category.name}
                onTitleUpdate={onRename}
              />
            }
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
            }}
          >
            <View
              style={{
                overflowY: 'auto',
                flex: 1,
              }}
            >
              <Notes
                notes={notasVisibles.length > 0 ? notasVisibles : t('No notes')}
                editable={false}
                focused={false}
                getStyle={() => ({
                  borderRadius: 6,
                  ...(notasVisibles.length === 0 && {
                    justifySelf: 'center',
                    alignSelf: 'center',
                    color: theme.pageTextSubdued,
                  }),
                })}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignContent: 'space-between',
                gap: 8,
                paddingTop: 10,
              }}
            >
              <Button style={buttonStyle} onPress={_onEditNotes}>
                <SvgNotesPaper
                  width={20}
                  height={20}
                  style={{ paddingRight: 5 }}
                />
                <Trans>Edit notes</Trans>
              </Button>
              {!category.is_income && (
                <Button
                  style={buttonStyle}
                  onPress={() => togglePinned(categoryId)}
                  data-testid="pin-category"
                >
                  <SvgPin
                    width={20}
                    height={20}
                    style={{
                      paddingRight: 5,
                      ...(pinned && { color: theme.noticeText }),
                    }}
                  />
                  {pinned ? (
                    <Trans>Unpin from home</Trans>
                  ) : (
                    <Trans>Pin to home</Trans>
                  )}
                </Button>
              )}
              {goalTemplatesEnabled && !category.is_income && (
                <Button
                  style={{
                    ...buttonStyle,
                    height: 'auto',
                    minHeight: styles.mobileMinHeight,
                    padding: '6px 10px',
                  }}
                  onPress={() => {
                    state.close();
                    void navigate(
                      `/categories/${category.id}/objetivo?month=${month ?? monthUtils.currentMonth()}`,
                    );
                  }}
                  data-testid="category-objetivo"
                >
                  <SvgTarget
                    width={20}
                    height={20}
                    style={{ paddingRight: 5, flexShrink: 0 }}
                  />
                  <View style={{ alignItems: 'flex-start', minWidth: 0 }}>
                    <Trans>Target</Trans>
                    <Text
                      style={{
                        ...styles.smallText,
                        color: theme.pageTextSubdued,
                        fontWeight: 400,
                      }}
                      data-testid="category-objetivo-resumen"
                    >
                      {resumenObjetivo(objetivo)}
                    </Text>
                  </View>
                </Button>
              )}
              {onEditAutomations && (
                <Button style={buttonStyle} onPress={_onEditAutomations}>
                  <SvgChartPie
                    width={20}
                    height={20}
                    style={{ paddingRight: 5 }}
                  />
                  <Trans>Budget automations</Trans>
                </Button>
              )}
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

function AdditionalCategoryMenu({
  category,
  categoryGroup,
  onDelete,
  onToggleVisibility,
}) {
  const { t } = useTranslation();
  const triggerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const itemStyle: CSSProperties = {
    ...styles.mediumText,
    height: styles.mobileMinHeight,
  };

  const getItemStyle = item => ({
    ...itemStyle,
    ...(item.name === 'delete' && { color: theme.errorTextMenu }),
  });

  return (
    <View>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-label={t('Menu')}
        onPress={() => {
          setMenuOpen(true);
        }}
      >
        <SvgDotsHorizontalTriple
          width={17}
          height={17}
          style={{ color: 'currentColor' }}
        />
        <Popover
          triggerRef={triggerRef}
          isOpen={menuOpen}
          placement="bottom start"
          onOpenChange={() => setMenuOpen(false)}
        >
          <Menu
            getItemStyle={getItemStyle}
            items={[
              !categoryGroup?.hidden && {
                name: 'toggleVisibility',
                text: category.hidden ? t('Show') : t('Hide'),
                icon: category.hidden ? SvgViewShow : SvgViewHide,
                iconSize: 16,
              },
              !categoryGroup?.hidden && Menu.line,
              {
                name: 'delete',
                text: t('Delete'),
                icon: SvgTrash,
                iconSize: 15,
              },
            ]}
            onMenuSelect={itemName => {
              setMenuOpen(false);
              if (itemName === 'delete') {
                onDelete();
              } else if (itemName === 'toggleVisibility') {
                onToggleVisibility();
              }
            }}
          />
        </Popover>
      </Button>
    </View>
  );
}
