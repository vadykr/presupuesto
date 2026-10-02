import { useCallback } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useDeleteCategoryMutation, useSaveCategoryMutation } from '#budget';
import { useCategories } from '#hooks/useCategories';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

/**
 * Abre la ficha de una categoría (modal `category-menu`: notas, fijar en
 * inicio, objetivo, ocultar, borrar) desde fuera de la pestaña Presupuesto,
 * con las mismas acciones que allí.
 */
export function useFichaCategoria(month: string) {
  const dispatch = useDispatch();
  const { data: { list: categories } = { list: [] as CategoryEntity[] } } =
    useCategories();
  const saveCategory = useSaveCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const goalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const goalTemplatesUIEnabled = useFeatureFlag('goalTemplatesUIEnabled');

  return useCallback(
    (id: CategoryEntity['id']) => {
      const category = categories.find(c => c.id === id);
      if (!category) {
        return;
      }
      const canEditAutomations =
        goalTemplatesEnabled &&
        goalTemplatesUIEnabled &&
        !(category.is_income && budgetType !== 'tracking');

      dispatch(
        pushModal({
          modal: {
            name: 'category-menu',
            options: {
              categoryId: category.id,
              month,
              onSave: cat => saveCategory.mutate({ category: cat }),
              onEditNotes: noteId => {
                dispatch(
                  pushModal({
                    modal: {
                      name: 'notes',
                      options: {
                        id: noteId,
                        name: category.name,
                        onSave: async (noteIdToSave, notes) => {
                          await send('notes-save', {
                            id: noteIdToSave,
                            note: notes,
                          });
                        },
                      },
                    },
                  }),
                );
              },
              onDelete: categoryId => {
                dispatch(collapseModals({ rootModalName: 'category-menu' }));
                deleteCategory.mutate({ id: categoryId });
              },
              onToggleVisibility: categoryId => {
                const cat = categories.find(c => c.id === categoryId);
                if (cat) {
                  saveCategory.mutate({
                    category: { ...cat, hidden: !cat.hidden },
                  });
                }
                dispatch(collapseModals({ rootModalName: 'category-menu' }));
              },
              ...(canEditAutomations && {
                onEditAutomations: (categoryId: string) => {
                  dispatch(collapseModals({ rootModalName: 'category-menu' }));
                  dispatch(
                    pushModal({
                      modal: {
                        name: 'category-automations-edit',
                        options: { categoryId, month },
                      },
                    }),
                  );
                },
              }),
            },
          },
        }),
      );
    },
    [
      budgetType,
      categories,
      deleteCategory,
      dispatch,
      goalTemplatesEnabled,
      goalTemplatesUIEnabled,
      month,
      saveCategory,
    ],
  );
}
