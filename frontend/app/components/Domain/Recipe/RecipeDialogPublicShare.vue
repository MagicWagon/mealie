<template>
  <BaseDialog
    v-model="dialog"
    bottom-sheet
    :title="$t('recipe-share.share-recipe')"
    :icon="$globals.icons.link"
  >
    <v-card-text>
      <v-text-field
        :model-value="link"
        :label="$t('recipe-share.share-recipe')"
        readonly
        hide-details
        @focus="selectLink"
      />
    </v-card-text>
    <v-card-actions class="justify-end">
      <BaseButton
        size="small"
        variant="text"
        @click="copyLink"
      >
        {{ $t("general.copy") }}
      </BaseButton>
      <BaseButton
        size="small"
        @click="shareLink"
      >
        {{ $t("general.share") }}
      </BaseButton>
    </v-card-actions>
  </BaseDialog>
</template>

<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { alert } from "~/composables/use-toast";

interface Props {
  link: string;
  name: string;
}

const props = defineProps<Props>();

const dialog = defineModel<boolean>({ default: false });
const i18n = useI18n();
const { copy, copied, isSupported: clipboardIsSupported } = useClipboard();

const nativeShareSupported = computed(() =>
  typeof navigator !== "undefined" && typeof navigator.share === "function",
);

function selectLink(event: FocusEvent) {
  (event.target as HTMLInputElement | null)?.select();
}

function isShareCancelled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

async function copyLink() {
  if (!clipboardIsSupported.value) {
    alert.error(i18n.t("general.clipboard-not-supported") as string);
    return;
  }

  try {
    await copy(props.link);
    alert[copied.value ? "success" : "error"](
      i18n.t(copied.value ? "recipe-share.recipe-link-copied-message" : "general.clipboard-copy-failure") as string,
    );
  }
  catch {
    alert.error(i18n.t("general.clipboard-copy-failure") as string);
  }
}

async function shareLink() {
  if (!nativeShareSupported.value) {
    await copyLink();
    return;
  }

  try {
    await navigator.share({
      title: props.name,
      url: props.link,
    });
  }
  catch (error) {
    if (!isShareCancelled(error)) {
      alert.error(i18n.t("events.something-went-wrong") as string);
    }
  }
}
</script>
