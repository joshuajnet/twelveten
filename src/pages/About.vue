<script setup>
import { ref } from 'vue';
import MailSignUp from '../components/MailSignUp.vue';
</script>

<template>
    <div class="container mx-auto text-sm py-4 px-3">
        <h2 class="text-xl font-bold mb-3">About</h2>
        <div class="md:flex md:justify-between gap-6 md:flex-row flex flex-col flex-col-reverse">
            <div class="md:w-1/2">
                <div class="max-w-full overflow-hidden w-full h-96 mb-10">
                    <iframe
                        class="w-full h-full"
                        frameborder="0"
                        src="https://www.google.com/maps/embed/v1/place?q=1104+West+Thorndale+Avenue,+Chicago,+IL,+USA&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8"
                    ></iframe>
                </div>
            </div>
            <div class="max-w-screen-sm">
                <div class="mb-4 text-2xl">Twelve Ten is a contemporary art gallery located in Chicago.</div>
                <h3 class="text-xl font-medium text-sky-900">Twelve Ten Gallery</h3>
                <div class="mb-4">
                    1104 West Thorndale Ave. <br />
                    Chicago IL, 60660<br />
                    <em
                        >Just East of the Red Line Thorndale train stop in Edgewater. Accessible as a ground floor
                        storefront</em
                    ><br /><br />

                    Hours: Temporarily closed for relocation. Re-opening January 2026.<br />
                    <!--Hours: Wednesday &mdash; Saturday, 1:00 &mdash; 6:00 PM, or by appointment.<br />-->
                </div>
                <div class="pb-4 mb-6 border-b">
                    <h3 class="text-xl font-medium text-sky-900">Joshua Johnson</h3>
                    Director<br />
                    <a href="mailto:mail@twelvetengallery.com">mail@twelvetengallery.com</a>
                </div>
                <div class="pb-4 mb-6 border-b">
                    <h3 class="text-xl font-medium text-sky-900">Follow us</h3>
                    <a
                        href="https://www.instagram.com/twelvetengallery/"
                        target="_blank"
                        class="no-underline flex items-center"
                        ><i class="lab la-instagram text-lg no-underline"></i> Instagram
                    </a>
                </div>
                <div class="pb-4 mb-6 border-b">
                    Twelve Ten Gallery is a member of the
                    <a href="https://www.newartdealers.org/" target="_blank">New Art Dealers Alliance</a>.
                </div>
                <MailSignUp class="mb-10" />
            </div>
        </div>
    </div>
</template>
