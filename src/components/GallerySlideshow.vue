<script>
export default {
    props: {
        slides: Object,
    },
    data() {
        return {
            indexVisible: 0,
            interval: null,
            paused: false,
            gridView: false,
            scrollView: false,
        };
    },
    mounted() {
        this.autoPlay(true);
        this.scrollStop();
    },
    methods: {
        next() {
            this.autoPlay(false);
            this.stopVideo();
            if (this.indexVisible < this.slides.length - 1) {
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
                this.indexVisible = this.slides.length - 1;
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
                if (this.indexVisible < this.slides.length - 1) {
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
        toggleGridView() {
            this.gridView = !this.gridView;
            this.autoPlay(false);
            this.takeOver(this.gridView);
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
                if ( window.pageYOffset >= slideshow.scrollHeight ) {
                    this.autoPlay(false);
                    this.stopVideo();
                }
            };
        },
    },
};
</script>

<template>
    <div class="p-3 shadow-inner mb-10 border-b border-zinc-100">
        <div class="flex justify-between items-center text-slate-400 mb-3">
            <div class="flex items-center font-roboto font-light text-sm">
                <span class="text-sm cursor-pointer hover:text-sky-900" @click="toggleScrollView()">Scroll View</span>
                <span class="ml-3 text-lg cursor-pointer hover:text-sky-900" @click="toggleGridView()"><i class="las la-th"></i></span>
            </div>
            <div class="flex gap-6 items-center">
                <div
                    v-if="!paused"
                    class="cursor-pointer text-lg hover:text-sky-900"
                    @click="autoPlay(false)"
                >
                    <i class="las la-pause"></i>
                </div>
                <div
                    v-if="paused"
                    class="cursor-pointer text-lg hover:text-sky-900"
                    @click="autoPlay(true)"
                >
                    <i class="las la-play"></i>
                </div>
            </div>
            <div class="font-roboto font-light text-sm cursor-pointer font-bold hover:text-sky-900" @click="scrollToPress()">Press Release</div>
        </div>
        <div class="flex justify-center align-items flex-col relative" id="slideshow">
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
            <div v-for="(slide, index) in slides" :key="index">          
                <div :class="{ onscreen: index === indexVisible }" class="offscreen w-[calc(100%-40px)] m-auto">
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
                    <img v-if="slide.image" :src="slide.image" class="mx-auto max-image-h max-w-full mb-3" />
                    <div class="max-w-sm text-sm">
                        <div v-if="slide.author">{{ slide.author }}</div>
                        <div v-if="slide.title" class="italic">{{ slide.title }}</div>
                        <div v-if="slide.date" class="text-sm">{{ slide.date }}</div>
                        <div v-if="slide.media" class="text-sm">{{ slide.media }}</div>
                        <div v-if="slide.dimensions" class="text-sm">{{ slide.dimensions }}</div>
                        <div v-if="slide.credit" class="text-xs">{{ slide.credit }}</div>
                    </div>
                </div>             
            </div>
        </div>
        <transition name="fade" mode="out-in">
            <div class="fixed top-0 bg-white w-full h-screen left-0 overflow-y-auto z-30" v-if="gridView">
                <div class="fixed top-3 md:right-6 right-3 cursor-pointer text-xl mx-3" @click="toggleGridView()">
                    <i class="las la-times"></i>
                </div>
                <div class="max-w-8xl mx-auto px-3 pt-12 pb-10 grid gap-3 2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 grid-cols-2">
                    <div 
                        v-for="(slide, index) in slides" 
                        :key="index" 
                        class="cursor-pointer h-[25vh] flex flex-grow hover:opacity-50 transition-opacity" 
                        @click="indexVisible = index, toggleGridView()">                       
                        <div v-if="slide.video" class="bg-black flex items-center flex-grow">
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
                        <transition name="fade" mode="out-in">
                            <div v-if="slide.image" class="flex flex-grow bg-center bg-cover" :style="`background-image:url(${slide.image})`" /> 
                        </transition>
                    </div>
                </div>
            </div>
        </transition>
        <transition name="fade" mode="out-in">
            <div class="fixed top-0 bg-white w-full h-screen left-0 overflow-y-auto z-30" v-if="scrollView">
                <div class="fixed top-3 md:right-6 right-3 cursor-pointer text-xl mx-3" @click="toggleScrollView()">
                    <i class="las la-times"></i>
                </div>
                <div class="max-w-8xl mx-auto px-3 pt-12 pb-10">
                    <div v-for="(slide, index) in slides" :key="index">
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
                            <img v-if="slide.image" :src="slide.image" class=" max-w-full max-h-full mb-2" />
                            <div class="max-w-sm text-sm">
                                <div v-if="slide.author">{{ slide.author }}</div>
                                <div v-if="slide.title" class="italic">{{ slide.title }}</div>
                                <div v-if="slide.date" class="text-sm">{{ slide.date }}</div>
                                <div v-if="slide.media" class="text-sm">{{ slide.media }}</div>
                                <div v-if="slide.dimensions" class="text-sm">{{ slide.dimensions }}</div>
                                <div v-if="slide.credit" class="text-xs">{{ slide.credit }}</div>
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
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.onscreen {
    position: relative !important;
    top: 0;
    left: 0 !important;
}
.offscreen {
    position: absolute;
    top: 0;
    left: -999999px;
}
.max-image-h {
    max-height: calc(100vh - 160px);
    width: auto;
}
.max-video-h {
    max-height: calc(100vh - 360px);
}
</style>
