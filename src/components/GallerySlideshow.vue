<script>
export default {
    props: {
        slides: Object,
        worksAvailable: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            indexVisible: 0,
            interval: null,
            paused: false,
            gridView: false,
            scrollView: false,
            availableView: false,
            visibleSlides: [],
        };
    },
    mounted() {
        for (let slide of this.slides) {
            if (!slide.hidden) {
                this.visibleSlides.push(slide);
            }
        }
        this.autoPlay(true);
        this.scrollStop();
    },
    methods: {
        next() {
            this.autoPlay(false);
            this.stopVideo();
            if (this.indexVisible < this.visibleSlides.length - 1) {
                this.indexVisible += 1;
            } else {
                this.indexVisible = 0;
            }
        },
        prev() {
            this.autoPlay(false);
            this.stopVideo();
            if (this.indexVisible > 0) {
                this.indexVisible -= 1;
            } else {
                this.indexVisible = this.visibleSlides.length - 1;
            }
        },
        autoPlay(play) {
            if (!play) {
                this.paused = true;
                clearInterval(this.interval);
                return;
            }
            this.paused = false;
            this.interval = setInterval(() => {
                if (this.indexVisible < this.visibleSlides.length - 1) {
                    this.indexVisible += 1;
                } else {
                    this.indexVisible = 0;
                }
            }, 3000);
        },
        stopVideo() {
            const videos = document.getElementsByClassName('slide-video');
            for (let video of videos) {
                video.pause();
            }
        },
        goToSlide(index) {
            this.indexVisible = index;
            this.toggleGridView();
            window.scroll({
                top: 0,
                left: 0,
                behavior: 'instant',
            });
        },
        toggleGridView() {
            this.gridView = !this.gridView;
            this.autoPlay(false);
        },
        toggleScrollView() {
            this.scrollView = !this.scrollView;
            this.autoPlay(false);
            this.takeOver(this.scrollView);
        },
        takeOver(enabled) {
            if (enabled) {
                document.getElementById('app').classList.add('overlay-enabled');
            } else {
                document.getElementById('app').classList.remove('overlay-enabled');
            }
        },
        scrollToPress() {
            this.autoPlay(false);
            document.getElementById('press-release').scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        },
        scrollStop() {
            const app = document.getElementById('app');
            const slideshow = document.getElementById('slideshow');
            window.onscroll = () => {
                if (window.pageYOffset >= slideshow.scrollHeight) {
                    this.autoPlay(false);
                    this.stopVideo();
                }
            };
        },
        toggleAvailable() {
            this.autoPlay(false);
            this.visibleSlides = [];
            if (this.availableView) {
                for (let slide of this.slides) {
                    if (!slide.hidden) {
                        this.visibleSlides.push(slide);
                    }
                }
                this.indexVisible = 0;
                this.gridView = false;
                this.availableView = false;
            } else {
                for (let slide of this.slides) {
                    if (slide.available) {
                        this.visibleSlides.push(slide);
                    }
                }
                this.gridView = true;
                this.availableView = true;
            }
        },
        createMailTo(slide) {
            let url = `https://twelvetengallery.com${slide.image}`;
            let encodeSubject = encodeURIComponent(`Inquiry into work by ${slide.author}`);
            let encodeBody = encodeURIComponent(`Please provide me more information on the related work ${url}`);
            return `mailto:mail@twelvetengallery.com?subject=${encodeSubject}&body=${encodeBody}`;
        },
    },
};
</script>

<template>
    <div class="p-3 shadow-inner mb-10 border-b border-zinc-100">
        <div class="flex justify-between items-center text-slate-400 mb-3">
            <div class="flex items-center font-roboto font-light text-sm">
                <span class="text-sm cursor-pointer hover:text-sky-900" @click="toggleScrollView()">Scroll View</span>
                <span class="ml-3 text-lg cursor-pointer hover:text-sky-900" @click="toggleGridView()">
                    <i class="las la-th" v-if="!gridView"></i>
                    <i class="las la-expand" v-if="gridView"></i>
                </span>
            </div>
            <div class="flex gap-6 items-center" v-if="!gridView">
                <div v-if="!paused" class="cursor-pointer text-lg hover:text-sky-900" @click="autoPlay(false)">
                    <i class="las la-pause"></i>
                </div>
                <div v-if="paused" class="cursor-pointer text-lg hover:text-sky-900" @click="autoPlay(true)">
                    <i class="las la-play"></i>
                </div>
            </div>
            <div class="font-roboto font-light text-sm">
                <span v-if="worksAvailable">
                    <span v-if="!availableView" @click="toggleAvailable()" class="cursor-pointer hover:text-sky-900"
                        >Works Available</span
                    >
                    <span v-if="availableView" @click="toggleAvailable()" class="cursor-pointer hover:text-sky-900"
                        >Installation</span
                    >
                    |
                </span>
                <span @click="scrollToPress()" class="cursor-pointer hover:text-sky-900">Press Release</span>
            </div>
        </div>
        <!-- slide view -->
        <div class="flex justify-center align-items flex-col relative overflow-hidden" id="slideshow" v-if="!gridView">
            <div
                class="absolute top-0 left-0 w-1/2 h-full z-10 text-slate-400 hover:text-sky-900 cursor-pointer select-none"
                @click="prev()"
            >
                <div class="text-2xl cursor-pointer absolute top-1/2 left-0"><i class="las la-angle-left"></i></div>
            </div>
            <div
                class="absolute top-0 right-0 w-1/2 h-full z-10 text-slate-400 hover:text-sky-900 cursor-pointer select-none"
                @click="next()"
            >
                <div class="text-2xl cursor-pointer absolute top-1/2 right-0"><i class="las la-angle-right"></i></div>
            </div>
            <div class="loader"></div>
            <div v-for="(slide, index) in visibleSlides" :key="index">
                <div
                    :class="{ onscreen: index === indexVisible }"
                    class="slide-item offscreen w-[calc(100%-4rem)] m-auto"
                >
                    <div v-if="slide.video" class="xl:max-w-5xl max-w-3xl w-full mx-auto mb-2 z-20 relative">
                        <video
                            @click="autoPlay(false)"
                            width="100%"
                            height="auto"
                            class="slide-video w-full h-auto"
                            controls
                        >
                            <source :src="slide.video" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                    <img
                        v-if="slide.image"
                        v-lazy="slide.image"
                        class="lazy-image mx-auto max-image-h max-w-full mb-3"
                    />
                    <div class="mx-auto text-center max-w-sm text-xs">
                        <div v-if="slide.author">{{ slide.author }}</div>
                        <div v-if="slide.title || slide.date">
                            <span v-if="slide.title" class="italic">{{ slide.title }}</span>
                            <span v-if="slide.date">, {{ slide.date }}</span>
                        </div>
                        <div v-if="slide.media">{{ slide.media }}</div>
                        <div v-if="slide.dimensions">{{ slide.dimensions }}</div>
                        <div v-if="slide.credit">{{ slide.credit }}</div>
                        <div v-if="slide.available && worksAvailable" class="relative z-20">
                            <a
                                :href="createMailTo(slide)"
                                class="py-1 px-3 inline-block cursor-pointer hover:text-sky-600 !no-underline border hover:shadow mt-3 font-roboto font-light"
                            >
                                <i class="las la-envelope mr-1"></i> Inquire
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- grid view -->
        <transition name="fade" mode="out-in">
            <div class="w-full" v-if="gridView">
                <div
                    class="max-w-8xl mx-auto grid gap-3 2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 grid-cols-2"
                >
                    <div v-for="(slide, index) in visibleSlides" :key="index" class="h-[25vh] flex flex-grow relative">
                        <div
                            v-if="slide.video"
                            class="bg-black flex items-center flex-grow hover:opacity-50 transition-opacity cursor-pointer"
                            @click="goToSlide(index)"
                        >
                            <video
                                @click="stopVideo()"
                                width="100%"
                                height="100%"
                                class="slide-video w-full h-auto"
                                oncontextmenu="return false;"
                                controls
                            >
                                <source :src="slide.video" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        <div
                            v-if="slide.image"
                            class="flex flex-grow bg-slate-50 hover:opacity-50 transition-opacity cursor-pointer"
                            @click="goToSlide(index)"
                        >
                            <img v-lazy="slide.image" class="lazy-image object-cover w-full h-full" />
                        </div>
                        <div v-if="availableView" class="absolute bottom-3 right-3">
                            <a
                                :href="createMailTo(slide)"
                                class="py-1 px-3 inline-block cursor-pointer bg-white/80 hover:text-sky-600 !no-underline border hover:shadow mt-3 font-roboto font-light text-xs"
                            >
                                <i class="las la-envelope mr-1"></i> Inquire
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
        <!-- scroll view -->
        <transition name="fade" mode="out-in">
            <div class="fixed top-0 bg-white w-full h-screen left-0 overflow-y-auto z-30" v-if="scrollView">
                <div class="fixed top-3 md:right-6 right-3 cursor-pointer text-xl mx-3" @click="toggleScrollView()">
                    <i class="las la-times"></i>
                </div>
                <div class="max-w-8xl mx-auto px-3 pt-12 pb-10">
                    <div v-for="(slide, index) in visibleSlides" :key="index">
                        <div class="mb-10 flex flex-col">
                            <div v-if="slide.video" class="xl:max-w-5xl max-w-3xl w-full mb-2">
                                <video
                                    @click="autoPlay(false)"
                                    width="100%"
                                    height="auto"
                                    class="slide-video w-full h-auto"
                                    controls
                                >
                                    <source :src="slide.video" type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            <img
                                v-if="slide.image"
                                v-lazy="slide.image"
                                class="lazy-image max-w-full max-h-full mb-2"
                            />
                            <div class="max-w-sm text-sm">
                                <div v-if="slide.author">{{ slide.author }}</div>
                                <div v-if="slide.title" class="italic">{{ slide.title }}</div>
                                <div v-if="slide.date" class="text-sm">{{ slide.date }}</div>
                                <div v-if="slide.media" class="text-sm">{{ slide.media }}</div>
                                <div v-if="slide.dimensions" class="text-sm">{{ slide.dimensions }}</div>
                                <div v-if="slide.credit" class="text-xs">{{ slide.credit }}</div>
                                <div v-if="slide.available" class="relative z-20">
                                    <a
                                        :href="createMailTo(slide)"
                                        class="py-1 px-3 inline-block cursor-pointer hover:text-sky-600 !no-underline border hover:shadow mt-3 font-roboto font-light"
                                    >
                                        <i class="las la-envelope mr-1"></i> Inquire
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>
<style scoped="postcss">
.grid-padded:before {
    padding-top: 100%;
}
.fade-enter-active,
.fade-leave-active {
    transition: all 0.5s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
.slide-item {
    opacity: 1;
    transition: opacity 0.5s ease-in-out;
    min-height: 10rem;
}
.onscreen {
    opacity: 1 !important;
    position: relative !important;
    left: 0 !important;
}
.offscreen {
    opacity: 0;
    position: absolute;
    left: 2rem;
    top: 0;
}
.max-image-h {
    max-height: calc(100vh - 160px);
    width: auto;
}
.max-video-h {
    max-height: calc(100vh - 360px);
}
.lazy-image {
    transition: opacity 0.5s ease-in-out;
}
img[lazy='loading'] {
    opacity: 0;
}
img[lazy='loaded'] {
    opacity: 1;
}
.loader {
    @apply border-2 border-sky-900 rounded-full absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    aspect-ratio: 1;
    animation: l20-1 0.8s infinite linear alternate, l20-2 1.6s infinite linear;
}
@keyframes l20-1 {
    0% {
        clip-path: polygon(50% 50%, 0 0, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%);
    }
    12.5% {
        clip-path: polygon(50% 50%, 0 0, 50% 0%, 100% 0%, 100% 0%, 100% 0%, 100% 0%);
    }
    25% {
        clip-path: polygon(50% 50%, 0 0, 50% 0%, 100% 0%, 100% 100%, 100% 100%, 100% 100%);
    }
    50% {
        clip-path: polygon(50% 50%, 0 0, 50% 0%, 100% 0%, 100% 100%, 50% 100%, 0% 100%);
    }
    62.5% {
        clip-path: polygon(50% 50%, 100% 0, 100% 0%, 100% 0%, 100% 100%, 50% 100%, 0% 100%);
    }
    75% {
        clip-path: polygon(50% 50%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 50% 100%, 0% 100%);
    }
    100% {
        clip-path: polygon(50% 50%, 50% 100%, 50% 100%, 50% 100%, 50% 100%, 50% 100%, 0% 100%);
    }
}
@keyframes l20-2 {
    0% {
        transform: translate(-50%, -50%) scaleY(1) rotate(0deg);
    }
    49.99% {
        transform: translate(-50%, -50%) scaleY(1) rotate(135deg);
    }
    50% {
        transform: translate(-50%, -50%) scaleY(-1) rotate(0deg);
    }
    100% {
        transform: translate(-50%, -50%) scaleY(-1) rotate(-135deg);
    }
}
</style>
