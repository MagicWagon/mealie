<template>
  <BaseDialog
    v-model="dialog"
    width="650"
    :title="title"
    :icon="$globals.icons.organizers"
    :loading="loading"
    keep-open
    can-submit
    disable-submit-on-enter
    :submit-disabled="loading || !canSave"
    @submit="save"
    @cancel="cancel"
  >
    <v-card-text>
      <v-radio-group
        v-if="isBulk"
        v-model="operation"
        inline
        hide-details
        class="mb-4"
      >
        <v-radio
          value="add"
          :label="$t('recipe.add-organizers')"
        />
        <v-radio
          value="remove"
          :label="$t('recipe.remove-organizers')"
        />
      </v-radio-group>

      <RecipeOrganizerSelector
        v-model="tags"
        :selector-type="Organizer.Tag"
        :show-add="true"
      />
      <RecipeOrganizerSelector
        v-model="recipeCategory"
        :selector-type="Organizer.Category"
        :show-add="true"
      />
    </v-card-text>

    <template #card-actions>
      <BaseButton
        cancel
        :disabled="loading"
        @click="cancel"
      />
      <v-spacer />
      <BaseButton
        save
        :loading="loading"
        :disabled="!canSave"
        @click="save"
      />
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { alert } from "~/composables/use-toast";
import { deepCopy } from "~/composables/use-utils";
import { useUserApi } from "~/composables/api";
import type { Recipe, RecipeCategory, RecipeTag } from "~/lib/api/types/recipe";
import { Organizer } from "~/lib/api/types/non-generated";
import {
  buildBulkOrganizerPatches,
  buildSingleOrganizerPatch,
  type OrganizerOperation,
  type RecipeOrganizerSelection,
} from "./recipe-organizer-transform";

type OrganizerDialogMode = "single" | "bulk";

interface Props {
  recipes?: Recipe[];
  mode?: OrganizerDialogMode;
}

const props = withDefaults(defineProps<Props>(), {
  mode: "single",
  recipes: () => [],
});

const emit = defineEmits<{
  saved: [recipes: Recipe[]];
}>();

const dialog = defineModel<boolean>({ default: false });

const { $globals } = useNuxtApp();
const i18n = useI18n();
const api = useUserApi();

const tags = ref<RecipeTag[]>([]);
const recipeCategory = ref<RecipeCategory[]>([]);
const operation = ref<OrganizerOperation>("add");
const loading = ref(false);

const isBulk = computed(() => props.mode === "bulk");
const title = computed(() => isBulk.value ? i18n.t("recipe.organize-recipes") : i18n.t("recipe.organize-recipe"));
const canSave = computed(() => props.recipes.length > 0 && !loading.value);

function initialize() {
  operation.value = "add";

  if (isBulk.value) {
    tags.value = [];
    recipeCategory.value = [];
    return;
  }

  const recipe = props.recipes[0];
  tags.value = deepCopy(recipe?.tags ?? []);
  recipeCategory.value = deepCopy(recipe?.recipeCategory ?? []);
}

watch(dialog, (isOpen) => {
  if (isOpen) {
    initialize();
  }
});

watch(
  () => props.recipes,
  () => {
    if (dialog.value) {
      initialize();
    }
  },
);

const selection = computed<RecipeOrganizerSelection>(() => ({
  tags: tags.value,
  recipeCategory: recipeCategory.value,
}));

function cancel() {
  if (!loading.value) {
    dialog.value = false;
  }
}

function showSaveError() {
  alert.error(i18n.t("recipe.recipe-update-failed"));
}

async function save() {
  if (!canSave.value) {
    return;
  }

  loading.value = true;

  try {
    if (isBulk.value) {
      await saveBulk();
    }
    else {
      await saveOne();
    }
  }
  catch (error) {
    console.error("Failed to organize recipes", error);
    showSaveError();
  }
  finally {
    loading.value = false;
  }
}

async function saveOne() {
  const recipe = props.recipes[0];
  const recipeSlug = recipe?.slug || recipe?.id;
  if (!recipe || !recipeSlug) {
    showSaveError();
    return;
  }

  const patch = buildSingleOrganizerPatch(selection.value);
  const { data, error } = await api.recipes.patchOne(recipeSlug, patch);
  if (error || !data) {
    showSaveError();
    return;
  }

  alert.success(i18n.t("recipe.recipe-updated"));
  dialog.value = false;
  emit("saved", [data]);
}

async function saveBulk() {
  const patches = buildBulkOrganizerPatches(props.recipes, selection.value, operation.value);
  if (patches.length === 0) {
    // Empty organizer fields are intentionally a no-op in bulk mode.
    dialog.value = false;
    return;
  }

  const { data, error } = await api.recipes.patchMany(patches as Recipe[]);
  if (error || !data) {
    showSaveError();
    return;
  }

  alert.success(i18n.t("recipe.recipe-updated"));
  dialog.value = false;
  emit("saved", data);
}
</script>
