<script setup lang="ts">
import { ref } from 'vue';
import { mailchimpSubscribe } from '@/api/mailchimp';

/**
 * Mailchimp embedded signup. Submits to Mailchimp's JSON endpoint in place (no page change);
 * without JavaScript the form still posts to Mailchimp in a new tab.
 */
const ACTION = 'https://twelvetengallery.us11.list-manage.com/subscribe/post?u=acb8c0fb5a6397cbff7e6647b&id=b6cb0482a9&f_id=005bb0e0f0';

const email = ref('');
const sending = ref(false);
const result = ref<{ ok: boolean; message: string } | null>(null);

async function submit(e: Event) {
    const form = e.target as HTMLFormElement;
    if (sending.value) return;
    sending.value = true;
    result.value = null;
    try {
        result.value = await mailchimpSubscribe(ACTION, new FormData(form));
        if (result.value.ok) email.value = '';
    } catch {
        result.value = { ok: false, message: 'Could not reach the mailing list. Please try again.' };
    } finally {
        sending.value = false;
    }
}
</script>

<template>
    <div id="mc_embed_shell">
        <link href="//cdn-images.mailchimp.com/embedcode/classic-061523.css" rel="stylesheet" type="text/css" />
        <div id="mc_embed_signup">
            <form
                :action="ACTION"
                method="post"
                id="mc-embedded-subscribe-form"
                name="mc-embedded-subscribe-form"
                class="validate"
                target="_blank"
                style="margin: 0"
                @submit.prevent="submit"
            >
                <div id="mc_embed_signup_scroll">
                    <h3 class="text-xl font-medium text-sky-900 mb-3">Join our mailing list</h3>
                    <div class="mc-field-group">
                        <label for="mce-EMAIL">Email Address</label
                        ><input
                            type="email"
                            name="EMAIL"
                            class="required email"
                            id="mce-EMAIL"
                            required
                            v-model="email"
                        /><span id="mce-EMAIL-HELPERTEXT" class="helper_text"></span>
                    </div>
                    <div id="mce-responses" class="clear foot" aria-live="polite">
                        <div v-if="result && !result.ok" class="response" id="mce-error-response" style="display: block">{{ result.message }}</div>
                        <div v-if="result?.ok" class="response" id="mce-success-response" style="display: block">{{ result.message }}</div>
                    </div>
                    <div aria-hidden="true" style="position: absolute; left: -5000px">
                        /* real people should not fill this in and expect good things - do not remove this or risk form
                        bot signups */
                        <input type="text" name="b_acb8c0fb5a6397cbff7e6647b_b6cb0482a9" tabindex="-1" value="" />
                    </div>
                    <div class="optionalParent">
                        <div class="clear foot">
                            <input
                                type="submit"
                                name="subscribe"
                                id="mc-embedded-subscribe"
                                class="button bg-sky-900! text-white"
                                :value="sending ? 'Subscribing…' : 'Subscribe'"
                                :disabled="sending"
                            />
                            <p style="margin: 0px auto">
                                <a href="http://eepurl.com/ix3WdU" title="Mailchimp - email marketing made easy and fun"
                                    ><span
                                        style="display: inline-block; background-color: transparent; border-radius: 4px"
                                        ><img
                                            class="refferal_badge"
                                            src="https://digitalasset.intuit.com/render/content/dam/intuit/mc-fe/en_us/images/intuit-mc-rewards-text-dark.svg"
                                            alt="Intuit Mailchimp"
                                            style="
                                                width: 120px;
                                                height: 20px;
                                                display: flex;
                                                padding: 2px 0px;
                                                justify-content: center;
                                                align-items: center;
                                            " /></span
                                ></a>
                            </p>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>
