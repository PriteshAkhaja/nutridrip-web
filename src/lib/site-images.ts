/**
 * Photography for the public site, in one place: the file, what it shows (its
 * alt text), where the subject sits in the frame -- so a crop at any ratio keeps
 * it -- and who took it.
 *
 * Every photograph except homeHero is from Unsplash under the Unsplash License
 * (free for commercial use, no attribution required). The credits are kept here
 * and in public/images/README.md regardless. To use the company's own
 * photography, add the file under public/images/site/ with a new name and point
 * the entry here at it, with its width, height and blur. Not under an old name:
 * resized copies are cached by address for four hours, on the server and in
 * browsers, so a same-name swap keeps showing the old picture until then.
 *
 * `blur` is a 20px-wide copy, shown while the full image loads. It is written
 * by the script that prepared the set, so regenerate it with the file.
 */
export type SiteImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS object-position: the subject's place in the frame. */
  position: string;
  credit: string;
  blur: string;
};

export const SITE_IMAGES = {
  homeHero: {
    src: "/images/home-hero.jpg",
    alt: "A nurse in lilac scrubs adjusting an IV drip for a man resting on the sofa in his own living room",
    width: 1402,
    height: 1122,
    position: "58% 42%",
    credit: "NutriDrip",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAQABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMFAv/EAB4QAAIDAAIDAQAAAAAAAAAAAAECAAMRBBIGEyNB/8QAFgEBAQEAAAAAAAAAAAAAAAAAAgED/8QAGBEAAwEBAAAAAAAAAAAAAAAAABEhARL/2gAMAwEAAhEDEQA/AKPlDAImfpkUL7BqNhESvOu5gSu1+zTafAMhIJYw82jcEWNUHPZhsIq2lGsJbdhM3hUf/9k=",
  },
  dripBag: {
    src: "/images/site/drip-bag.jpg",
    alt: "An IV bag and its drip chamber hanging from a stand in soft light",
    width: 1400,
    height: 2100,
    position: "50% 28%",
    credit: "Samuel Ramos",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAeABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAUGAwT/xAAfEAACAgIDAAMAAAAAAAAAAAABAgADBBEFITETIjL/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABcRAQEBAQAAAAAAAAAAAAAAAAARATH/2gAMAwEAAhEDEQA/AFvFXKuR99gER/iLW4LVyewiouXY6lHxgBRiB1uQct1bfIfYRk1QJPUIukRmO5SzZHkqOJtIxuwRsxPxuOrXqW7lTUiLWAFEdGBvG/ITcqu/zCItf//Z",
  },
  dripChamber: {
    src: "/images/site/drip-chamber.jpg",
    alt: "Close-up of an IV drip chamber and clear tubing",
    width: 1600,
    height: 1067,
    position: "32% 50%",
    credit: "Marcelo Leal",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQACBP/EABsQAAIDAQEBAAAAAAAAAAAAAAABAgMRBEFR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAQAC/8QAFhEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIRAxEAPwA7ipbpUn4xXlinZoZzPKHn0R5ZPTOGOtxWkYc3pCn/2Q==",
  },
  dripLineWindow: {
    src: "/images/site/drip-line-window.jpg",
    alt: "Clear IV tubing in front of a bright window, a city blurred beyond it",
    width: 1600,
    height: 1067,
    position: "58% 50%",
    credit: "Camila Mofsovich",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAMCBAUG/8QAHRAAAQQDAQEAAAAAAAAAAAAAAQACERIDBDEUIf/EABUBAQEAAAAAAAAAAAAAAAAAAAAC/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/AOoZuSYPVP0G0SsrFs2ElglOZmJfyESuZNqj4QlVDvp6hKR//9k=",
  },
  dripWindowLight: {
    src: "/images/site/drip-window-light.jpg",
    alt: "An IV drip chamber hanging against a softly lit window screen",
    width: 1600,
    height: 1063,
    position: "60% 40%",
    credit: "Hiroshi Tsubono",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAUGAQT/xAAgEAABBAEEAwAAAAAAAAAAAAABAAIDBBEFBjFBFBUh/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCnpkebOcjlLd0uHrZvvSl36rbje8tlOTyuG5qtqeIskkJaelAsyhYhUf/Z",
  },
  dripStand: {
    src: "/images/site/drip-stand.jpg",
    alt: "A stainless IV stand holding an infusion bag against a teal wall",
    width: 1600,
    height: 1066,
    position: "66% 45%",
    credit: "Marcelo Leal",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAIDBP/EABsQAAMAAgMAAAAAAAAAAAAAAAABAgMREiFh/8QAFwEAAwEAAAAAAAAAAAAAAAAAAAECA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AMOKSjj0ljY7p8i2BalbAWq7ADf/2Q==",
  },
  vialCheck: {
    src: "/images/site/vial-check.jpg",
    alt: "A hand holding a small glass vial up to read its label",
    width: 1400,
    height: 2100,
    position: "62% 34%",
    credit: "National Cancer Institute",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAeABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAUBAgQD/8QAIhAAAgICAQQDAQAAAAAAAAAAAQIAAwQRMQUSIUETUXGR/8QAGAEAAgMAAAAAAAAAAAAAAAAAAgMAAQT/xAAbEQEAAwEAAwAAAAAAAAAAAAABAAIREgNRYf/aAAwDAQACEQMRAD8Aw9IqyRUz0hh+RklWdahAdu76M2UsuNQRUAJONllBYX5PEztzqOKORQ3TOpFidn+wjJhms21s8HiEM8j6IHH2UsJKFgPC+pFF7OdNUFEd24Vd9Z0O3fMV5+sIpWAD3e4tphGF9ZktzstLCtSbUcQnf5yngAQlliRHZ//Z",
  },
  vialsMono: {
    src: "/images/site/vials-mono.jpg",
    alt: "Glass vials, ampoules and an infusion bottle, in black and white",
    width: 1600,
    height: 1164,
    position: "50% 62%",
    credit: "National Cancer Institute",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAOABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUBAgb/xAAeEAACAgICAwAAAAAAAAAAAAABAgARAwQFQRMVMf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDKDUyEWFNSF1nZqoxrj5NUoDEKHUt7BHYHwgQFo1B21GEYFsLEscf2ED//2Q==",
  },
  pharmacist: {
    src: "/images/site/pharmacist.jpg",
    alt: "A pharmacist smiling as she takes a box down from a stocked shelf",
    width: 1600,
    height: 1067,
    position: "34% 40%",
    credit: "National Cancer Institute",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABAABAv/EACIQAAIBAwIHAAAAAAAAAAAAAAECAAMRQQRhBRITFSEiMf/EABYBAQEBAAAAAAAAAAAAAAAAAAMBAv/EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwBL6yzqiJzLkxr116K4GYPhxtQbwCd4p1DURcfYEJWdwp0/UKTvKdrpqYUC0puJX//Z",
  },
  physician: {
    src: "/images/site/physician.jpg",
    alt: "A physician with a stethoscope, arms folded, in a clinic corridor",
    width: 1400,
    height: 1799,
    position: "50% 24%",
    credit: "vaibhav vivian",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAaABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAQFAwb/xAAiEAACAgEEAQUAAAAAAAAAAAABAgADIQQREjFBBRMUYZH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/xAAWEQEBAQAAAAAAAAAAAAAAAAAAARH/2gAMAwEAAhEDEQA/AKVij4jL9SP6ciDVEoMjuVBYDVnzM61qpfdQBv5mLGpTRQHMIs9zBsGECVRqzaeKt1HH1Ce2AwyJzNbEdEiaO7kjdm/ZcTVp9WOXcJKYnfuED//Z",
  },
  physicianPhone: {
    src: "/images/site/physician-phone.jpg",
    alt: "A doctor in a white coat holding a phone in both hands, a stethoscope at the collar",
    width: 1600,
    height: 1413,
    position: "50% 58%",
    credit: "National Cancer Institute",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAASABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYEBf/EACQQAAEDAgUFAQAAAAAAAAAAAAIAAQQDEQUSEyFBFCIxUXGR/8QAFgEBAQEAAAAAAAAAAAAAAAAAAQAC/8QAGBEBAQEBAQAAAAAAAAAAAAAAABEBIRL/2gAMAwEAAhEDEQA/AKQaRjRHI3c77rnYs0fXESIcxbOy34lK6WGRj54UNLKVMkariT25WbOHMvVjTjx6dMRa1rcIoU8Um0ScGqE1vaJo8rua14pX3+rJQEdJtm/ERGpNYmI9dU7W8+kRFF//2Q==",
  },
  nursePrep: {
    src: "/images/site/nurse-prep.jpg",
    alt: "A nurse, lit from a window behind her, drawing up a syringe from a vial",
    width: 1400,
    height: 2100,
    position: "46% 42%",
    credit: "maks_d",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAeABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAQDBQYH/8QAIxAAAQMDAwUBAAAAAAAAAAAAAQACAwQFERITIQYUIzFBU//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/AC7Xupp3NYxugp+33KpnpmvdDnP1UV5qoqq6AHhjTgla62duKJmyRoARC/eTfiUKzAaRkAIQjnV4j2rhIMY5TlmNXVOEEMjg0e0t1DLuXN/GMcK06Mf5pBj4g1VLC6Gnax7tRHsoUmUIP//Z",
  },
  vitalsHome: {
    src: "/images/site/vitals-home.jpg",
    alt: "A nurse fitting a blood-pressure cuff to an older man's arm at a table at home",
    width: 1600,
    height: 1067,
    position: "62% 34%",
    credit: "Nappy",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAUDBAb/xAAeEAACAgMAAwEAAAAAAAAAAAABAgADBAUREjFhgf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAGBEAAwEBAAAAAAAAAAAAAAAAAAERAiH/2gAMAwEAAhEDEQA/AHuwIrqIQ9PJQ1eR4ZIrQdDe4tGztdXRgCD9kujsYZZbv5C0pCvLXTU8EIsys+xLyoAhJUIz/9k=",
  },
  goalEnergy: {
    src: "/images/site/goal-energy.jpg",
    alt: "A woman stretching outdoors in bright morning light",
    width: 1400,
    height: 2099,
    position: "50% 26%",
    credit: "Christina Moroz",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAeABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAUCAwQG/8QAIxAAAgICAQQCAwAAAAAAAAAAAQIAAwQREgUhQVEGEzFhcf/EABcBAAMBAAAAAAAAAAAAAAAAAAEDBAD/xAAbEQADAAMBAQAAAAAAAAAAAAAAAQIREiEDE//aAAwDAQACEQMRAD8AeuvBCfUrx+bkhvx4luexTHOjrfmLcDNZr0rIPrfuCrxQJ88yxkaoTTxhGbCtDnPkPWq2RaaGGye5kse1sfFS0AE67ExXk9GWx+Ys0Ywpo+7DWiw9l8iTU1xl0y+o0pk5Ni8vsA3+4TMMBEGg7a/sJtwfM//Z",
  },
  goalRest: {
    src: "/images/site/goal-rest.jpg",
    alt: "A woman relaxing on a sofa at home, smiling",
    width: 1600,
    height: 1067,
    position: "40% 50%",
    credit: "Shane Ryan Herilalaina",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAwAEBf/EAB8QAAICAgIDAQAAAAAAAAAAAAECAAMEEQUhBhITMf/EABUBAQEAAAAAAAAAAAAAAAAAAAID/8QAGBEBAQADAAAAAAAAAAAAAAAAAAECESH/2gAMAwEAAhEDEQA/AC4trLQEQD2EfyLGdsZCy9mcPHzrMZvpX000WczkZSat0RJzqmUDTYaawgH5KC9hZidalHoH/9k=",
  },
  goalSkin: {
    src: "/images/site/goal-skin.jpg",
    alt: "Portrait of a young woman in soft natural light",
    width: 1600,
    height: 1065,
    position: "56% 34%",
    credit: "Himanshu Dewangan",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAIDBAX/xAAfEAACAgIBBQAAAAAAAAAAAAABAgADEhMEETFBUXH/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//EABcRAAMBAAAAAAAAAAAAAAAAAAABAhH/2gAMAwEAAhEDEQA/AN0PhQSPAlKh7Nq2Z9VbuvqSGw6fsfhhSpGIgbFE6tGcAtCJYxDkQiJn/9k=",
  },
  goalSkin2: {
    src: "/images/site/goal-skin-2.jpg",
    alt: "Close portrait of a woman in warm, low light",
    width: 1400,
    height: 2489,
    position: "50% 36%",
    credit: "Jatin Punia",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAkABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAUCAwQG/8QAIhAAAgEEAQQDAAAAAAAAAAAAAQIAAwQRISIFEjFRExQy/8QAFwEBAAMAAAAAAAAAAAAAAAAAAgABA//EABkRAQEBAQEBAAAAAAAAAAAAAAABERIhMf/aAAwDAQACEQMRAD8A5tiKOsZJk1SoU72Tj7krqg32R6McWtN6tgyKgIGiYdxcmkho5ORCMRbhRgwiBkv6pa6UL4jy0U0OnjDfrzENBVeoWbYWaVvHdiinj4md+tJ5Gmo6lzuErCLjkdwi6Hkuc9hbt1LbIczCEi0qzH5DuEISE//Z",
  },
  goalTravel: {
    src: "/images/site/goal-travel.jpg",
    alt: "An aircraft wing seen through a cabin window, over the sea",
    width: 1400,
    height: 2195,
    position: "62% 56%",
    credit: "William Bayreuther",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAfABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAIEBQYD/8QAIRAAAgICAgEFAAAAAAAAAAAAAQIAAwQRBSETBjEyQWH/xAAXAQEBAQEAAAAAAAAAAAAAAAADAgEE/8QAGhEAAgMBAQAAAAAAAAAAAAAAAAECETETIf/aAAwDAQACEQMRAD8AzNVL2nSKTGfFtT5KZrfTmFSeNFjAbP2ZLyOOpsUkFTNrwJyaeGCIIOiIS0z8ZEymUQhKaOnmzrxnIvXjGkHqM2Vd5AEsIB/ZSq5X2Mbzvve5bwJbZMzbt5B2d9QkAsWOye4SFGkI52z/2Q==",
  },
  goalImmunity: {
    src: "/images/site/goal-immunity.jpg",
    alt: "Two halves of an orange on a teal surface",
    width: 1400,
    height: 2100,
    position: "56% 46%",
    credit: "Lucas George Wendt",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAeABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAIDBAH/xAAdEAACAgMAAwAAAAAAAAAAAAAAAgERAxIhIjGB/8QAFgEBAQEAAAAAAAAAAAAAAAAAAwQC/8QAHREAAgICAwEAAAAAAAAAAAAAAQIAAxIxBBEiIf/aAAwDAQACEQMRAD8AVVooqXF0dVN19gssni0fQ7bCfNe5LxqlHu4fIsp0B5m5AZcuh3JXKZHHUliy68kq2TYyK4+80ZWpVbIRLOQ71is6lZboGeXmwFk+M//Z",
  },
  goalPostviral: {
    src: "/images/site/goal-postviral.jpg",
    alt: "A woman wrapped in a blanket on a sofa, holding a warm drink",
    width: 1600,
    height: 1067,
    position: "44% 44%",
    credit: "Slaapwijsheid.nl",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFA//EAB8QAAICAgIDAQAAAAAAAAAAAAECAAMEESFREhMiMf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEh/9oADAMBAAIRAxEAPwDTHurRdA89ShhWFq9t3IuCqnJUsNyl7DTb8cDf5ImLOu6eXMIpbeWfZUQgH//Z",
  },
  goalHydration: {
    src: "/images/site/goal-hydration.jpg",
    alt: "A woman drinking a glass of water",
    width: 1600,
    height: 1067,
    position: "40% 40%",
    credit: "engin akyurt",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQAEBv/EACAQAAICAgICAwAAAAAAAAAAAAECAAMEEQUhEzEUQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADAv/EABcRAQEBAQAAAAAAAAAAAAAAAAARASH/2gAMAwEAAhEDEQA/AB+GxnGQGZD1O0xbxTUpsOt+twbjdV51uOBtV9GbUb5SWI/XjPREPpbkPK4ZQR9yh+NawoUfkpdHH//Z",
  },
  goalAthletic: {
    src: "/images/site/goal-athletic.jpg",
    alt: "A man stretching on a wooden deck after exercise",
    width: 1600,
    height: 1068,
    position: "62% 46%",
    credit: "Scott Broome",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFA//EACAQAAEDAwUBAAAAAAAAAAAAAAEAAgMEESEFEhQxQSL/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwClDIA3JSdZqbIyWP8Ai/RSFFWSSvLnHrxZ6k/kizwMKUihFsezcDe/qFCNVJDZjTgIQf/Z",
  },
  goalLabs: {
    src: "/images/site/goal-labs.jpg",
    alt: "Rows of blood collection tubes with coloured caps in a laboratory rack",
    width: 1600,
    height: 1067,
    position: "50% 50%",
    credit: "Testalize.me",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAGAAAAgMAAAAAAAAAAAAAAAAAAAQCBQb/xAAfEAACAgICAwEAAAAAAAAAAAABAgADBBESEwUiMUH/xAAWAQEBAQAAAAAAAAAAAAAAAAADAgT/xAAZEQEBAAMBAAAAAAAAAAAAAAABABITMWH/2gAMAwEAAhEDEQA/AJgCj1RNGL3p2MOxNqYtgeXuc8LVV9/pl/bjo2Mrga2Pkc7Gtn3wMLkdpCO38a7NBAYS8Sz7T2//2Q==",
  },
  citySkyline: {
    src: "/images/site/city-skyline.jpg",
    alt: "Apartment blocks and rooftops across a residential Bengaluru neighbourhood at dusk",
    width: 1600,
    height: 1097,
    position: "50% 40%",
    credit: "Vishwanth Pindiboina",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAOABQDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABAACBf/EAB8QAAEEAgIDAAAAAAAAAAAAAAIAAQMRBBIhMRMUUf/EABUBAQEAAAAAAAAAAAAAAAAAAAEC/8QAGBEBAQADAAAAAAAAAAAAAAAAAAEREiH/2gAMAwEAAhEDEQA/AOf79A2sjrJZhSVZddI4Qx+MeOSR5Y3jk12tlPFW0ybMkE6E7ZSEwP8AVJ1Ga//Z",
  },
  bengaluruDusk: {
    src: "/images/site/bengaluru-dusk.jpg",
    alt: "Bengaluru from above at dusk: leafy residential streets, with the elevated Namma Metro line and a station running through them",
    width: 1600,
    height: 1200,
    position: "50% 58%",
    credit: "Priyansh Patidar",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAPABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAQFAgP/xAAcEAADAQACAwAAAAAAAAAAAAAAAQIRAwUhMkH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAv/EABYRAQEBAAAAAAAAAAAAAAAAAAARIf/aAAwDAQACEQMRAD8ASjtcfmTd905WKCC+dTKzWd6qahUhypPvuK31AmNUn8Aqh//Z",
  },
  cityStreet: {
    src: "/images/site/city-street.jpg",
    alt: "A green and yellow auto-rickshaw passing on a Bengaluru street",
    width: 1600,
    height: 1066,
    position: "48% 46%",
    credit: "Akshay Nanavati",
    blur: "data:image/jpeg;base64,/9j/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAANABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFBv/EAB8QAAIDAAICAwAAAAAAAAAAAAECAAMRBCEFQRIiUf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFREBAQAAAAAAAAAAAAAAAAAAACH/2gAMAwEAAhEDEQA/AJlpsstZwp7H5Fiof6vuj0RNuPH0L2FyJ8ziUlSfgAR7yBlRVYBi6BCWTWoOZCSLX//Z",
  },
} satisfies Record<string, SiteImage>;

export type SiteImageKey = keyof typeof SITE_IMAGES;

/**
 * The picture for each of the nine launch drips. A drip added later in the
 * Drip builder falls back to its category's picture, then to the bag itself, so
 * a new formula is never left without one.
 */
const BY_SLUG: Record<string, SiteImageKey> = {
  "myers-revive": "dripBag",
  "deep-recharge": "goalRest",
  "jetlag-reset": "goalTravel",
  "iron-restore": "goalLabs",
  "immune-shield": "goalImmunity",
  "post-viral-rebuild": "goalPostviral",
  "glow-protocol": "goalSkin",
  "hydrate-plus": "goalHydration",
  "athletic-recovery": "goalAthletic",
};

const BY_CATEGORY: Record<string, SiteImageKey> = {
  Energy: "goalEnergy",
  Immunity: "goalImmunity",
  Skin: "goalSkin",
  Hydration: "goalHydration",
  "Athletic recovery": "goalAthletic",
  "Post-viral": "goalPostviral",
};

export function dripImage(slug: string, category: string): SiteImage {
  return SITE_IMAGES[BY_SLUG[slug] ?? BY_CATEGORY[category] ?? "dripBag"];
}

/**
 * The "By goal" tiles on the home page. Deliberately not the drip pictures:
 * the most-booked cards sit just above them, and the same photograph twice on
 * one screen reads as a template.
 */
const GOAL_TILE: Record<string, SiteImageKey> = {
  Energy: "goalEnergy",
  Immunity: "goalTravel",
  Skin: "goalSkin2",
  Hydration: "dripChamber",
  "Athletic recovery": "goalAthletic",
  "Post-viral": "goalPostviral",
};

export function goalImage(category: string): SiteImage {
  return SITE_IMAGES[GOAL_TILE[category] ?? BY_CATEGORY[category] ?? "dripBag"];
}
