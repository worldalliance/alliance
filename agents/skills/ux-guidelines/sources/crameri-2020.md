# The misuse of colour in science communication

Source: <https://www.nature.com/articles/s41467-020-19160-7>

Retrieved: 2026-11-09

Crameri, F., Shephard, G.E. & Heron, P.J. The misuse of colour in science communication. Nat Commun 11, 5444 (2020). Open Access, licensed under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/). Changes: converted from HTML to Markdown, with the journal's navigation and reader comments left out.

---

## Abstract

The accurate representation of data is essential in science communication. However, colour maps that visually distort data through uneven colour gradients or are unreadable to those with colour-vision deficiency remain prevalent in science. These include, but are not limited to, rainbow-like and red–green colour maps. Here, we present a simple guide for the scientific use of colour. We show how scientifically derived colour maps report true data variations, reduce complexity, and are accessible for people with colour-vision deficiencies. We highlight ways for the scientific community to identify and prevent the misuse of colour in science, and call for a proactive step away from colour misuse among the community, publishers, and the press.

## Introduction

Vision is one of the most fundamental means of communication. It is (or should be) in every scientist’s best intention to make figures and their content as accurate and easily understandable as possible. One of the most powerful aspects of images is colour, which in turn transforms information into meaning. The visual evaluation of a colour gradient is important to a variety of different fields such as the first direct impression of a black hole[1](/articles/s41467-020-19160-7#ref-CR1 "Akiyama, K. et al. First M87 event horizon telescope results. IV. Imaging the central supermassive black hole. Astrophys. J. Lett. 875, L4 (2019)."), the mapping of votes cast in political elections[2](/articles/s41467-020-19160-7#ref-CR2 "Long, E. Election Data Visualisation (University of Plymouth, 2013)."),[3](/articles/s41467-020-19160-7#ref-CR3 "Cox, A., Bostock, M., Watkins, D. & Shan, C. The Most Detailed Maps You’ll See from the Midterm Elections., 
https://www.nytimes.com/interactive/2014/11/04/upshot/senate-maps.html
(2014)."), the planning of an expensive rover route on Martian topography[4](/articles/s41467-020-19160-7#ref-CR4 "Lemoine, F. G. et al. An improved solution of the gravity field of Mars (GMM-2B) from Mars Global Surveyor. J. Geophys. Res.: Planets 106, 23359–23376 (2001)."), the essential communication of climate change[5](/articles/s41467-020-19160-7#ref-CR5 "Hawkins, E. Scrap rainbow colour scales. Nature 519, 291 EP (2015)."),[6](/articles/s41467-020-19160-7#ref-CR6 "IPCC. Global Warming of 1.5° C: An IPCC Special Report on the Impacts of Global Warming of 1.5° C Above Pre-industrial Levels and Related Global Greenhouse Gas Emission Pathways, in the Context of Strengthening the Global Response to the Threat of Climate Change, Sustainable Development, and Efforts to Eradicate Poverty. (Intergovernmental Panel on Climate Change, 2018)."), or the critical diagnosis of heart disease[7](/articles/s41467-020-19160-7#ref-CR7 "Borkin, M. et al. Evaluation of artery visualizations for heart disease diagnosis. IEEE Trans. Vis. Computer Graph. 17, 2479–2488 (2011)."). However, when colours are used incorrectly, this can lead to the effective manipulation of data (e.g., by highlighting some data over others), the oversight of the needs of those with colour vision deficiencies, and the removal of meaning when printed in black and white (Supplementary Note [1](/articles/s41467-020-19160-7#MOESM1)).

As science has become more prevalent in mainstream culture, it is not only the scientific community that suffers due to the use of poor colour choices, but also the wider public. Colour maps, therefore, are a crucial intersection between science and society. For instance, weather forecasts and hazard maps are two examples of immediately societal-relevant data sets that are also repeat offenders for use of the rainbow-like colour maps. Given the (daily) importance of these scientific topics, the underlying data should be conveyed in a universal manner. However, the colour-vision deficient fraction of the population is excluded and therefore unable to process this critical information. Furthermore, zones of danger, such as the boundaries of a hurricane track or current virus spread, are often based on uneven colour gradients to accentuate their importance. Using an uneven colour gradient is not an action without consequences, including those with significant financial or life-threatening consequences. Decisions based on data being ‘unfairly’ represented could produce, for instance, a Martian rover being sent over terrain that is too steep as the topography was inaccurately visualised, or a medical worker making an incomplete or inaccurate diagnosis based on uneven colour gradients.

Although some scientific communities have largely moved away from using distorting colour maps, such as rainbow, there are numerous signs of bad habits returning en masse[8](/articles/s41467-020-19160-7#ref-CR8 "McNeall, D. How many Rainbows at EGU 2018, <
https://betterfigures.org/2018/04/16/how-many-rainbows-at-egu-2018

> (2020)."). Unfortunately, the previous efforts within specific disciplines to discredit rainbow-like maps appear to have not trickled through to all scientific leaders, publishers, and software designers. For most scientists, the choice of colour maps has become almost passive, with the unscientific rainbow-like colour palette being commonplace. Similarly, colour maps that pair red–green are also problematic, but remain widely used. At one point, most of the common software programmes applied rainbow as their default palette (e.g., MatLab, Paraview, VisAd, IrisExplorer) despite issues surrounding colour maps like rainbow, and variations thereof, being known for some time[9](#ref-CR9 "Bertin, J. Graphics and Graphic Information Processing. (Walter de Gruyter, 2011)."),[10](#ref-CR10 "Bertin, J. Semiology of graphics; diagrams networks maps. (University of Wisconsin, Press, Madison, 1983)."),[11](#ref-CR11 "Tufte, E. R. Envisioning Information. Vol. 126 (Graphics Press, 1990)."),[12](#ref-CR12 "Travis, D. Effective Color Displays: Theory and Practice. Vol. 1991 (Academic press London, 1991)."),[13](#ref-CR13 "Brewer, C. A. Color use guidelines for mapping. Vis. Mod. Cartogr. 1994, 123–148 (1994)."),[14](#ref-CR14 "MacEachren, A. M. How Maps Work: Representation, Visualization, and Design. (Guilford Press, 2004)."),[15](#ref-CR15 "Dent, B. D., Torguson, J. S. & Hodler, T. W. Cartography: Thematic Map Design. Vol. 5 (WCB/McGraw-Hill New York, 1999)."),[16](#ref-CR16 "Robinson, A. Elements of Cartography. (John Wiley and Sons, New York, 1960)."),[17](#ref-CR17 "Monmonier, M. How to Lie with Maps (University of Chicago Press, 2018)."),[18](#ref-CR18 "Light, A. & Bartlein, P. J. The end of the rainbow? Color schemes for improved data graphics. Eos Trans. AGU 85, 385–391 (2004)."),[19](#ref-CR19 "Stauffer, R., Mayr, G. J., Dabernig, M. & Zeileis, A. Somewhere over the rainbow: how to make effective use of colors in meteorological visualizations. Bull. Am. Meteorological Soc. 96, 203–216 (2015)."),[20](/articles/s41467-020-19160-7#ref-CR20 "Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. True colors of oceanography: guidelines for effective and accurate colormap selection. Oceanography 29, 9–13 (2016). Introducing the scientifically derived cmocean colour maps for better data visualisation in oceanography that also underline the importance of intuitive colour palettes given a certain data parameter.").

So, what’s the problem with these colour maps? Even though rainbow colour maps might reflect aesthetic attractiveness, the extreme values in the standard Red-Green-Blue (RGB) are very dominant and can, therefore, distract from the underlying visual message[21](/articles/s41467-020-19160-7#ref-CR21 "Cairo, A. The Functional Art: An Introduction to Information Graphics and Visualization. (New Riders, 2012)."). In rainbow colour maps, the yellow is the brightest colour and attracts the eye the most[22](/articles/s41467-020-19160-7#ref-CR22 "Wolfe, J. M. & Horowitz, T. S. Five factors that guide attention in visual search. Nat. Hum. Behav. 1, 0058 (2017)."),[23](/articles/s41467-020-19160-7#ref-CR23 "Alexander, K. R. & Shansky, M. S. Influence of hue, value, and chroma on the perceived heaviness of colors. Percept. Psychophys. 19, 72–74 (1976).") (see Box [1](/articles/s41467-020-19160-7#Sec2)), but it is neither at the end nor the centre of the colour map, while its greenish shades form a wide band with low perceived colour contrast (Supplementary Fig. [1](/articles/s41467-020-19160-7#MOESM1)). Hence, such an arrangement of colours can unfairly highlight a particular section of the parameter space while obscuring other parts (Fig. [1](/articles/s41467-020-19160-7#Fig1)). Building a colour map on a purely physical rather than a perceptual basis significantly alters how we perceive data; it adds artificial boundaries to some parts of the data range, hiding small-scale variations elsewhere, it prevents any visual intuitive order occurring in the data set, and renders the data unreadable for readers with common colour-vision deficiencies (Fig. [2](/articles/s41467-020-19160-7#Fig2)).

**Fig. 1: The superiority of scientifically derived colour maps.**

![Fig. 1: The superiority of scientifically derived colour maps.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig1_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/1)

By knowing what something looks like in advance, the distortion by unscientific colour maps, like jet or rainbow, becomes instantly obvious. The look of scientific data is, however, usually unknown a priori, which makes the distortion of an unscientific colour map, and the true data representation of a scientifically derived colour map, like batlow[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."), less apparent. Marie Skłodowska-Curie, as originally photographed by Henri Manuel around 1920, the Earth from space, and an apple are shown **a** in their original images and **b** in distorted and **c** in undistorted colour versions. Inferring the true picture from an unscientifically (e.g., jet) coloured data set is incomparably harder than from a data set represented in a perceptually uniform and ordered colour map, like batlow[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020).").

**Fig. 2: Colour vision tests.**

![Fig. 2: Colour vision tests.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig2_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/2)

Available perceptually uniform colour maps versus the non-uniform rainbow (i.e., jet; bottom row) as seen with either of the three common forms of human colour-vision deficiency (deuteranopia, protanopia, and tritanopia), and for grey-scale (representing total colour-blindness or simple black-and-white prints). Rainbow, the most-widely used colour map, fails to reproduce a meaningful smooth gradient, yet the other colour maps (see Box 2) are all universally readable.

Colour maps that include both red and green colours with similar lightness cannot be read by a large fraction of the readership (Fig. [2](/articles/s41467-020-19160-7#Fig2)). The general estimate is that worldwide 0.5% of women and 8% of men are subject to a colour-vision deficiency (CVD; e.g., refs. [24](/articles/s41467-020-19160-7#ref-CR24 "Sharpe, L. T., Stockman, A., Jägle, H. & Nathans, J. Opsin Genes, Cone Photopigments, Color Vision, and Color Blindness. Vol. 351 (Cambridge University Press, 1999)."),[25](/articles/s41467-020-19160-7#ref-CR25 "Neitz, J. & Neitz, M. The genetics of normal and defective color vision. Vis. Res. 51, 633–651 (2011)."), and references therein). While these numbers are lower and almost disappear in populations from sub-Saharan Africa, they are likely significantly higher in populations with a larger fraction of white (Caucasian) people as, for example, in Scandinavia[26](/articles/s41467-020-19160-7#ref-CR26 "Drummond-Borg, M., Deeb, S. S. & Motulsky, A. G. Molecular patterns of X chromosome-linked color vision genes among 134 men of European ancestry. Proc. Natl Acad. Sci. 86, 983–987 (1989)."). It is needless to state that scientific results should be accessible to as many people as possible. CVD-friendliness is, therefore, an aspect that should be important to all researchers, as well as publishers[18](/articles/s41467-020-19160-7#ref-CR18 "Light, A. & Bartlein, P. J. The end of the rainbow? Color schemes for improved data graphics. Eos Trans. AGU 85, 385–391 (2004)."),[27](/articles/s41467-020-19160-7#ref-CR27 "Albrecht, M. Color blindness. Nat. Methods 7, 775 EP (2010)."),[28](/articles/s41467-020-19160-7#ref-CR28 "Wong, B. Reply to \\“More on color blindness\\“. Nat. Methods 8, 891 EP (2011).").

For the casual reader, it might appear curious that the community of scientists, a group of people who are usually more critically inclined, fail to condemn the proliferation among themselves of rainbow and other, similarly unfit, colour maps. Based on this prevalence of unscientific colour maps, a basic understanding of their nature (Supplementary Fig. [2](/articles/s41467-020-19160-7#MOESM1)) and their dynamics seems to be missing in the academic community. Colour map choice is often made passively and is not subject to the same scrutiny as other data methodologies. Rainbow’s eye-grabbing nature, ease of use, and the inertia of both software products and scientific group leaders, allows the scientific community to remain attached to this unscientific colour map[29](/articles/s41467-020-19160-7#ref-CR29 "Moreland, K. Why we use bad color maps and what you can do about it. Electron. Imaging 2016, 1–6 (2016). The widespread use of the rainbow is the main reason scientists propagate it further, which must therefore be considered if a scientific alternative is to be effective."). As a result, pointing out colour map flaws to the science community through scientific peer-review remains a challenging task, as requests or suggestions to change the colour palette are often met with rebuttal, misunderstanding, or are simply ignored.

Here, we highlight the importance of the scientific use of colour in data visualisation. We summarise methods to generate colour maps that deliver equal colour gradients all along the colour axis, to prevent data distortion. Various types of scientifically derived colour maps are readily and freely available (Box [2](/articles/s41467-020-19160-7#Sec3)), and are the only way to intuitively and inclusively represent data without any blind interpretation. We outline key guidelines for choosing scientific colour maps that most accurately represent your data, and highlight how to spot common unscientific colour maps so they can be avoided. Finally, we call for a universal switch by the science community to adopt scientifically derived colour maps. Individuals, publishers and press should take a proactive approach to spot unscientific use of colour and so prevent the dissemination of visually distorted data.

### BOX 1: Human colour perception

Colour is not inherent in objects. A perceived colour is the portion of light that is reflected from a surface and translated into a specific colour by our eyes and brain (Box Fig. [1](/articles/s41467-020-19160-7#Fig1)). A certain colour is perceived via its hue, the true tint (i.e., yellow, orange, red, violet, blue or green), and its luminosity (the measure of how bright or dark a hue is). Within the eye, one type of light receptors, the rod cells, process achromatic information (i.e., lightness or grey-scale vision), which is derived mostly from the light’s energy. The other type, the cone cells, handle chromatic information (the hue) mostly from the light’s wavelength. The latter transmit information to the brain and create the sensation of colour that is so familiar to most of us.

Two thirds of all cone cells process longer wavelengths of light (i.e., colours like red, orange, yellow), which allows the human eye to perceive more colour detail across warmer colours than for cooler colours[54](/articles/s41467-020-19160-7#ref-CR54 "Curcio, C. A. et al. Distribution and morphology of human cone photoreceptors stained with anti‐blue opsin. J. Comp. Neurol. 312, 610–624 (1991)."). Greenish colour gradients tend to under-represent a given data variation compared to yellow-red gradients. Three types of cone cells (for short, medium and, long wavelengths) build the trichromatic visual system that can, as a whole, represent all colours in our visual spectrum[55](#ref-CR55 "Meyer, G. W. & Greenberg, D. P. Color-defective vision and computer graphics displays. IEEE Computer Graph. Appl. 8, 28–40 (1988)."),[56](#ref-CR56 "Lennie, P., Pokorny, J. & Smith, V. C. Luminance. J. Optical Soc. Am. A: Opt. Image Sci., Vis. 10, 1283–1293 (1993)."),[57](#ref-CR57 "Kaiser, P. & Boynton, R. Human Color Vision. 2nd edn, (Optical Society of America, 1996)."),[58](/articles/s41467-020-19160-7#ref-CR58 "Roorda, A., Metha, A. B., Lennie, P. & Williams, D. R. Packing arrangement of the three cone classes in primate retina. Vis. Res. 41, 1291–1306 (2001).").

The physiological prerequisites for perceiving colour suggest that there is no uniform colour perception among individuals[59](/articles/s41467-020-19160-7#ref-CR59 "Lafer-Sousa, R., Hermann, K. L. & Conway, B. R. Striking individual differences in color perception uncovered by ‘the dress’ photograph. Curr. Biol. 25, R545–R546 (2015)."); several physiological deviations can lead to a shift in colour perception, which, in general, is hardly measurable[60](/articles/s41467-020-19160-7#ref-CR60 "Emery, K. J. & Webster, M. A. Individual differences and their implications for color perception. Curr. Opin. Behav. Sci. 30, 28–33 (2019)."). However, it is not unlikely that at least one of the cone cell types is altered, defect, or even absent, which induces a significant shift in colour vision. Such a shift is commonly referred to as colour-vision deficiency (CVD), or colour blindness, and can be modelled by a given combination of the three fundamental spectral sensitivity functions representing short, medium and long wavelengths of the light[55](/articles/s41467-020-19160-7#ref-CR55 "Meyer, G. W. & Greenberg, D. P. Color-defective vision and computer graphics displays. IEEE Computer Graph. Appl. 8, 28–40 (1988).") (as represented in Fig. [2](/articles/s41467-020-19160-7#Fig2)). The most common form of colour-vision deficiency is the red–green dichromatism, called deuteranomaly, concerning the M-cone and causing red and green to appear indistinguishable. Protanomaly, concerning the L-cone, and tritanomaly, concerning the S-cone cause reduced sensitivity to red and blue light, respectively. Total colour blindness is, fortunately, very rare, but does exist.

Box Fig. [1](/articles/s41467-020-19160-7#Fig1): **Simplified schematic of human colour perception**. The perception of a certain colour, or colour gradient, by the optical cortex depends not only on the optical properties of the object, but also on the optical properties of both light source and object background, and the eye’s light receptors (rod and cone cells for short, medium and long wavelengths).

![](//media.springernature.com/lw703/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Figa_HTML.png)

### BOX 2 Freely available scientifically derived colour maps and toolkits

Scientifically derived colour maps should be easily recognisable, and also be freely and readily available. While there are many online sources to download pre-made colour maps, and toolboxes to create colour maps, only few offer all the aspects required for use in science communication. Below, we mention the most accessible and/or robustly documented sources of scientifically derived colour maps, and outline their individual properties.

- **Colorbrewer**: The Colorbrewer colour maps (available at ref. [61](/articles/s41467-020-19160-7#ref-CR61 "Brewer, C. A. Colorbrewer Colour Maps, 
https://colorbrewer2.org/
(2020).")) developed by Cynthia Brewer are provided through an online tool to manually produce and export a variety of discrete colour maps, which can, optionally, be colour-vision deficiency friendly and exported to a given a variety of formats. With the main aim being cartography, the online tool offers sequential, diverging and categorical (or in other words, qualitative) colour maps, but does not currently offer them in a continuous type.

- **MPL** (Matplotlib): The MPL colour maps (available at ref. [62](/articles/s41467-020-19160-7#ref-CR62 "van der Walt, S. & Smith, N. MPL Colour Maps, 
https://bids.github.io/colormap
(2020).")) developed by Stéfan van der Walt and Nathaniel Smith. MPL maps aim for the most accurate perceptual uniformity with its widely applied colour maps being: viridis, magma, plasma and inferno. These maps have spearheaded the way towards more scientific colour mapping. The MPL colour maps are all sequential and continuous only. The MPL colour maps are openly available (currently for use with Python) and often built into software.

- **Cividis**: The cividis colour map[38](/articles/s41467-020-19160-7#ref-CR38 "Nuñez, J. R., Anderton, C. R. & Renslow, R. S. Optimizing colormaps with consideration for color vision deficiency to enable accurate interpretation of scientific data. PLoS ONE 13, e0199239 (2018). Developed the mathematically optimal colour map for readers with different colour-vision deficiencies named Cividis, which allows most accurate perception of data by as many viewers as possible.") (available at ref. [63](/articles/s41467-020-19160-7#ref-CR63 "Nuñez, J. R., Anderton, C. R. & Renslow, R. S. Cividis colour map, PLoS ONE, https://www.doi.org/10.1371/journal.pone.0199239.s002 (2020).")), developed by Jamie R. Nuñez and colleagues, aims to represent an almost identical appearance for red–green colour-vision deficiencies, the closest of all currently available colour maps, while also being perceptually uniform. The colour-vision deficiency friendly, sequential and continuous colour map is currently available as a standard colour array.

- **CMOcean** (colormaps inspired by oceanography): The CMOcean colour maps[20](/articles/s41467-020-19160-7#ref-CR20 "Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. True colors of oceanography: guidelines for effective and accurate colormap selection. Oceanography 29, 9–13 (2016). Introducing the scientifically derived cmocean colour maps for better data visualisation in oceanography that also underline the importance of intuitive colour palettes given a certain data parameter.") (available at ref. [64](/articles/s41467-020-19160-7#ref-CR64 "Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. CMOcean Colour Maps, 
http://matplotlib.org/cmocean
(2020).")), developed by Kristen M. Thyng and colleagues, aim to provide the most intuitive colours for a given suite of physical parameters, while now also being perceptually uniform. A variety of continuous sequential, diverging and cyclic colour maps are provided to allow for an intuitive, true representation of a given physical parameter field. The CMOcean colour maps are available in a large variety of file formats.

- **CET** (Centre for Exploration Targeting): The CET colour maps[32](/articles/s41467-020-19160-7#ref-CR32 "Kovesi, P. Good colour maps: how to design them. CoRR abs/1509.03700 (2015). Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue.") (available at ref. [65](/articles/s41467-020-19160-7#ref-CR65 "Kovesi, P. CET Colour Maps, 
http://peterkovesi.com/projects/colourmaps
(2020).")), developed by Peter Kovesi, aim to offer a large choice of the most common colour combinations in a wide variety of data formats. Many of the offered colour maps feature perceptual uniformity, although not all of them to the highest standards. The CET colour maps are continuous and cover sequential, diverging, and cyclic classes.

- **Scientific colour maps**: The Scientific colour maps[30](/articles/s41467-020-19160-7#ref-CR30 "Crameri, F. Geodynamic diagnostics, scientific visualisation and StagLab 3.0. Geoscientific Model Dev. 11, 2541–2562 (2018).") (available at ref. [41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."), and permanently archived at ref. [52](/articles/s41467-020-19160-7#ref-CR52 "Crameri, F. Scientific colour maps: perceptually uniform and colour-vision deficiency friendly. Zenodo, 
https://doi.org/10.5281/zenodo.1243862
(2018).")) are perceptually uniform (based on the underlying methodology of the CET colour maps[65](/articles/s41467-020-19160-7#ref-CR65 "Kovesi, P. CET Colour Maps, 
http://peterkovesi.com/projects/colourmaps
(2020).")), perceptually ordered, colour-vision deficiency and colour-blind friendly, readable in black and white prints, and, if applied properly, also data set specific and parameter intuitive. The Scientific colour maps include sequential, diverging, and cyclic palettes, which are also provided as discrete and categorical palettes, and are available in a multitude of different file formats. They are also available through external routines and as built-in versions in a variety of software programmes. In contrast to others, the Scientific colour map package includes individual colour map diagnostics, and is versioned on a long-term online repository so individual versions can be accurately cited, which allows active developments from the community (e.g., improve their perceptual uniformity to the latest standards), and aids overall scientific reproducibility.

### The importance of colour to prevent data distortion

Scientific data should be displayed without the addition of visually artificial features or subtraction of real details, while also being universally readable and intuitive. A perceptually uniform colour map weights the same data variation equally all across the dataspace, while other colour maps (such as rainbow) interpret some small data variation to be more important than others (Fig. [3](/articles/s41467-020-19160-7#Fig3)). For such unscientific, perceptually non-uniform colour maps (like rainbow), the interpretation is performed blindly (i.e., by the colour map instead of by the author) as the author or reader is not aware of the exact visual distortion that is introduced by the colour map (Fig. [3](/articles/s41467-020-19160-7#Fig3)). Any scientific study drawing conclusions from a given set of data is, therefore, strongly dependent on the perceptual uniformity of the colour palette applied and, with it, author and reader become captive to a blind interpretation (for various examples, see Supplementary Note [1](/articles/s41467-020-19160-7#MOESM1)). Such a colour-introduced blind interpretation can diverge from an objective representation by more than seven percent of the displayed data variation[30](/articles/s41467-020-19160-7#ref-CR30 "Crameri, F. Geodynamic diagnostics, scientific visualisation and StagLab 3.0. Geoscientific Model Dev. 11, 2541–2562 (2018).") (Fig. [3e–f](/articles/s41467-020-19160-7#Fig3)). A flat slope on Mars can become visually distorted by the most prominent local gradients in colour rather than data, and then appears like rough terrain, while rough terrain conversely might be interpreted as a flat slope (compare Supplementary Fig. [7a, b](/articles/s41467-020-19160-7#MOESM1)), which is suboptimal with regards to a Martian exploration.

**Fig. 3: Colour map measure, distortion, and error.**

![Fig. 3: Colour map measure, distortion, and error.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig3_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/3)

**a**, **b** The incremental lightness difference, Δ*E*, here using the \_CIEDE_2000 formulation (see ‘Methods’), is a measure for the perceptual colour difference along the colour map. For a perceptually uniform colour map, Δ_E\_\_CIEDE_2000 should be equal all along the colour map (i.e., a flat graph; **a**). Using **c**, **d** the cumulative colour lightness difference, Δ_E_Cumulative, it is possible to extract **e**, **f** the resulting visual error in percentage of total data variation. For scientifically derived colour maps like batlow[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."), the resulting error introduced to the data by the colouring is negligibly small as **g** the incremental data variation is represented equally all along the axis, and a linear data gradient, therefore, appears linear. Put differently, **i** a flat line looks flat. For non-scientific colour maps, like jet, **h** data gradients are unevenly represented and **f** visual error can be >7% of the displayed data variation such that **j** a linear graph (e.g., a flat line), for example, becomes unrecognisable.

Scientifically derived colour maps are perceptually uniform. This means the same data variation is weighted equally across the dataspace, and so the true data variation is accurately represented without unnecessary visual error (Fig. [3a, c, e, g, i](/articles/s41467-020-19160-7#Fig3)). Just like a spatial _x_\-, _y_\-, or _z_\-axis needs to have equal spacing between all axis tick marks (Fig. [3g, h](/articles/s41467-020-19160-7#Fig3)), a colour axis (commonly termed colour bar; Supplementary Fig. [1](/articles/s41467-020-19160-7#MOESM1)) needs to have equidistant colour gradients. In other words, a certain data variation (e.g., a 5 °C temperature drop) should appear the same no matter whether it occurs at low temperatures (–10 °C) or high temperatures (30 °C).

### Design and implementation of scientifically derived colour maps

While understanding the importance of perceptually uniform colour maps is simple, creating them can be complicated. Quantifying perceptual colour gradients is challenging because the complex nature of the human eye and brain has to be considered (Box [1](/articles/s41467-020-19160-7#Sec2)). However, extensive research has been conducted to understand and provide guidelines for an optimal colour map design (see description in ‘Methods’ and refs. [18](#ref-CR18 "Light, A. & Bartlein, P. J. The end of the rainbow? Color schemes for improved data graphics. Eos Trans. AGU 85, 385–391 (2004)."),[19](#ref-CR19 "Stauffer, R., Mayr, G. J., Dabernig, M. & Zeileis, A. Somewhere over the rainbow: how to make effective use of colors in meteorological visualizations. Bull. Am. Meteorological Soc. 96, 203–216 (2015)."),[20](/articles/s41467-020-19160-7#ref-CR20 "Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. True colors of oceanography: guidelines for effective and accurate colormap selection. Oceanography 29, 9–13 (2016). Introducing the scientifically derived cmocean colour maps for better data visualisation in oceanography that also underline the importance of intuitive colour palettes given a certain data parameter."),[29](/articles/s41467-020-19160-7#ref-CR29 "Moreland, K. Why we use bad color maps and what you can do about it. Electron. Imaging 2016, 1–6 (2016). The widespread use of the rainbow is the main reason scientists propagate it further, which must therefore be considered if a scientific alternative is to be effective."),[31](#ref-CR31 "Silva, S., Sousa Santos, B. & Madeira, J. Using color in visualization: a survey. Computer Graph. 35, 320–333 (2011)."),[32](#ref-CR32 "Kovesi, P. Good colour maps: how to design them. CoRR abs/1509.03700 (2015). Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue."),[33](#ref-CR33 "Szafir, D. A. Modeling color difference for visualization design. IEEE Trans. Vis. Computer Graph. 24, 392–401 (2018)."),[34](#ref-CR34 "Bujack, R. et al. The Good, the bad, and the ugly: a theoretical framework for the assessment of continuous colormaps. IEEE Trans. Vis. Computer Graph. 24, 923–933 (2018)."),[35](/articles/s41467-020-19160-7#ref-CR35 "Ware, C. et al. Measuring and modeling the feature detection threshold functions of colormaps. IEEE Trans. Vis. Computer Graph. 25, 2777–2790 (2019).")), and today, various freely available tools exist to create perceptually uniform colour palettes. In Box [2](/articles/s41467-020-19160-7#Sec3), we have compiled freely available scientific colour map toolkits, and described the benefits and limitations of each toolkit, to aid users in designing and/or selecting the most appropriate and accurate colour map for their data.

Perceptual uniformity is a crucial property for colour maps used in science, but by no means the only property to care about. Perceptual colour order is another important aspect in scientific colour map design, as it ensures the colour gradient is easily and intuitively understandable and allows qualitative understanding of a data set (Fig. [4](/articles/s41467-020-19160-7#Fig4)). To achieve perceptual order, both lightness and brightness should increase linearly to avoid the perception of artificial gradients and to easily discern and compare significant values. The heated black-body radiation palette, for which the colours can be easily ordered from black-red-orange-yellow (or vice versa), is one example. Perceptual order is, therefore, a great asset to a colour map by emphasising gradients and pattern(s) in data. Moreover yet, colour maps specifically created for certain data sets (e.g., ref. [36](/articles/s41467-020-19160-7#ref-CR36 "Zeller, S. & Rogers, D. Visualizing science: How color determines what we see. Eos Trans. AGU Vol. 101 (American Geophysical Union, 2020). 
https://doi.org/10.1029/2020EO144330
")) by no means guarantee their perceptual uniformity. Perceptual uniformity and intuitive colour order are both needed to prevent bias percolating into colour maps. This is also the case for so-called ‘improved’ rainbow-like maps such as Google’s Turbo[37](/articles/s41467-020-19160-7#ref-CR37 "Mikhailov, A. in Google AI Blog Vol. 2020 (Google, 
https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html
, 2019)."). Although Turbo appears to meet perceptual order, the perceptual uniformity requirement of a science-ready colour map is not met due to its non-uniform lightness spectra.

**Fig. 4: Perceptual uniformity and order.**

![Fig. 4: Perceptual uniformity and order.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig4_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/4)

A constant incremental colour and lightness contrast along a colour map is a proxy for its perceptual uniformity. **a** While a certain incremental data variation is either under- or strongly overrepresented with jet (a.k.a. rainbow) depending on the colour map segment, it is instead **b** evenly represented all along a colour bar when using a scientific colour map like batlow[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."), due to its uniform colour and lightness contrast. Perceptual order is given when individual colours of a colour map can be sequentially ordered effortlessly without consulting the colour bar. While **c** a sequential ordering is not intuitively possible for jet (a.k.a. rainbow), it is **d** possible to sequentially order individual colours of a scientifically derived colour map like batlow[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."), thanks to its constant lightness gradient.

In addition, colour maps should be universally readable, and they can be mathematically optimised to account for colour-vision deficiency using modern colour appearance models[38](/articles/s41467-020-19160-7#ref-CR38 "Nuñez, J. R., Anderton, C. R. & Renslow, R. S. Optimizing colormaps with consideration for color vision deficiency to enable accurate interpretation of scientific data. PLoS ONE 13, e0199239 (2018). Developed the mathematically optimal colour map for readers with different colour-vision deficiencies named Cividis, which allows most accurate perception of data by as many viewers as possible.") (Fig. [2](/articles/s41467-020-19160-7#Fig2) and Box [1](/articles/s41467-020-19160-7#Sec2)). As well as making colour palettes readable for readers with variable vision capabilities, it is also advantageous to make them readable for completely colour-blind readers. In contrast to other colour palettes, a colour map for scientific use should feature a uniform gradient across the whole colour axis. With an even, monotonic lightness gradient (Supplementary Fig. [1a](/articles/s41467-020-19160-7#MOESM1)), a colour palette remains readable (as well as perceptually uniform and ordered) even after a conversion to grey scale, assuming no complicated grey-scale filter is used.

To achieve the best possible data representation, colour palettes need to effectively convey the underlying data and its nature. This can be achieved by choosing the most appropriate colour map class and type (Fig. [5](/articles/s41467-020-19160-7#Fig5) and outlined in detail in [Supplementary Notes](/articles/s41467-020-19160-7#MOESM1) [2](/articles/s41467-020-19160-7#MOESM1) and [3](/articles/s41467-020-19160-7#MOESM1)). If the data is divergent about a central value (e.g., centred about zero), a divergent or a multi-sequential colour map should be chosen that clearly and intuitively distinguishes either side of the axis (Fig. [5](/articles/s41467-020-19160-7#Fig5), and Fig. [6](/articles/s41467-020-19160-7#Fig6) for a detailed user guide).

**Fig. 5: Colour map classes and types.**

![Fig. 5: Colour map classes and types.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig5_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/5)

The various classes of colour maps (_sequential_; _diverging_; _multi-sequential_; _cyclic_) and types (_continuous_; _discrete_; _categorical_). Only sequential colour maps can be faithfully applied to categorical types of data.

**Fig. 6: Guideline for choosing the right scientific colour map.**

![Fig. 6: Guideline for choosing the right scientific colour map.](//media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_Fig6_HTML.png)

[Full size image](/articles/s41467-020-19160-7/figures/6)

For effective data representation, the nature of a given data set has to be matched by a suitable colour map class, type, and colour combination.

An intuitive colour gradient becomes imperative if data are displayed without the provision of the colour bar (the axis relating colours to data values). Unfortunately, missing colour bars are more common than most would expect, as scales are sometimes cropped out or omitted during reproduction or subsequent dissemination (e.g., refs. [1](/articles/s41467-020-19160-7#ref-CR1 "Akiyama, K. et al. First M87 event horizon telescope results. IV. Imaging the central supermassive black hole. Astrophys. J. Lett. 875, L4 (2019)."),[4](/articles/s41467-020-19160-7#ref-CR4 "Lemoine, F. G. et al. An improved solution of the gravity field of Mars (GMM-2B) from Mars Global Surveyor. J. Geophys. Res.: Planets 106, 23359–23376 (2001)."),[39](/articles/s41467-020-19160-7#ref-CR39 "Hawkins, E. (
http://www.climate-lab-book.ac.uk/2018/2018-visualisation-update/
, 2019).")). It is imperative to ensure the colour bar is included on all figures where a colour scale is used, as even the most intuitive colour map could be rendered useless with no colour bar for the reader to refer to. Excluding a colour bar would be equivalent to not including the axis labels and tick marks on the _x_\- or _y_\-axis of a plot. Additionally, attention has to be paid to the lightness (i.e., light or dark) of the background on which the colours are displayed. Background creates contrast, in lightness and colour, to the displayed data (Supplementary Fig. [3](/articles/s41467-020-19160-7#MOESM1) and Supplementary Movie [1](/articles/s41467-020-19160-7#MOESM4)).

To optimise the use of the currently available perceptually uniform colour maps listed in Box [2](/articles/s41467-020-19160-7#Sec3), there are certain requirements to prevent them from becoming distorted (e.g., ref. [30](/articles/s41467-020-19160-7#ref-CR30 "Crameri, F. Geodynamic diagnostics, scientific visualisation and StagLab 3.0. Geoscientific Model Dev. 11, 2541–2562 (2018).")). As the colour bar has to be handled similarly to the position axis, parts of a scientifically derived colour map cannot be subsequently deformed by being partly squeezed or elongated. If the spacing between a position axis’ ticks were squeezed or elongated, it would visually distort the data in the figure. Simply put, a linear graph would no longer appear linear (Fig. [3h, j](/articles/s41467-020-19160-7#Fig3)). Therefore, altering any available scientifically derived colour map is not recommended. Additionally, avoiding certain types of graphs and plots is important to not alter the local perception of individual colours. Common heatmaps with directly connected colour tiles, as opposed to tiles with gaps in between, can alter individual colours significantly[40](/articles/s41467-020-19160-7#ref-CR40 "Wong, B. Color coding. Nat. Methods 7, 573 EP (2010).") (Supplementary Fig. [3](/articles/s41467-020-19160-7#MOESM1)).

### How to recognise an unscientific colour map

It is the responsibility of individuals, publishers, and the press to prevent the dissemination of visually distorted data and to take a proactive approach in spotting the unscientific use of colour. There are straightforward checks to recognise the unscientific use of colour that are handy for users, readers, reviewers and editors:

1.  1.

    The colour bar should be perceptually uniform to prevent data distortion and visual error. This means the perceptual colour differences between all neighbouring colours should appear the same. If two neighbouring colours have a different variation compared to other neighbouring colours (e.g., two greenish versus two yellowish-reddish colours in rainbow colour maps), the colour bar is perceptually non-uniform and not scientific (as shown in Fig. [4](/articles/s41467-020-19160-7#Fig4)).

2.  2.

    The colour map should not contain red and green at a similar luminosity (Box [1](/articles/s41467-020-19160-7#Sec2) for definitions). If this is the case, it can be assumed that these two colours cannot be distinguished by a large fraction of the readership and, therefore, fails as a scientific way of displaying data.

3.  3.

    The common rainbow colour map should not be used in data visualisation. There is not a single rainbow colour map with similarly bright colours across the colour bar that comes close to being scientific (e.g., ref. [32](/articles/s41467-020-19160-7#ref-CR32 "Kovesi, P. Good colour maps: how to design them. CoRR abs/1509.03700 (2015). Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue.")).

4.  4.

    The most secure test is to discard any colour map that is not described as scientifically derived (for example, is not listed in Box [2](/articles/s41467-020-19160-7#Sec3)), as it should be both perceptually uniform and CVD friendly.

### A proactive step forward for the science community

It is important to maintain the progress that has already been made across the scientific community (in particular in the fields of Earth, Space, and Climate science). Recently, a number of significant scientific achievements have been based upon non-distorting and universally readable scientifically derived colour maps, such as the first ever observation-based visualisation of a black hole[1](/articles/s41467-020-19160-7#ref-CR1 "Akiyama, K. et al. First M87 event horizon telescope results. IV. Imaging the central supermassive black hole. Astrophys. J. Lett. 875, L4 (2019)."), for which a lajolla-like colour map[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020).") was used, and the effective visualisation of climate change on a local, regional, and global level[39](/articles/s41467-020-19160-7#ref-CR39 "Hawkins, E. (
http://www.climate-lab-book.ac.uk/2018/2018-visualisation-update/
, 2019)."), which applied a vik-like colour map[41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020)."). However, there are danger signs that this progress could be lost. Unscientific colour maps are still often set as the default in software packages, which in turn also renders them a prevalent choice among many academic group leaders. Furthermore, unscientific colour maps are still accepted and published by academic journals. This combination leads users, students, and readers into believing that these choices are based on informed decisions, and that there are no fundamental issues with unscientific colour maps. Given this current landscape, it is an instructive reminder that new generations of scientists have to be made aware of the importance of scientifically derived colour maps and the pitfalls of those that are not.

Transferring the knowledge and awareness about the importance of scientifically derived colour maps to new generations of scientists is, therefore, a key goal. Teaching is a frontline tool in building solid visualisation skills. Indeed, learning and applying scientific data visualisation should be a requirement to receive BSc, MSc, and PhD degrees. Here, we provide an instructive user guide for choosing and applying a suitable scientific colour map (Fig. [6](/articles/s41467-020-19160-7#Fig6)), which should be part of every research office, and possibly even desk space. We provide a poster (Supplementary Data [1](/articles/s41467-020-19160-7#MOESM3)) that can be placed in communal areas, like near a printing station, coffee machine or restroom, that highlights the key advantages of scientifically derived colour maps and serves as a conversation starter.

Recommendations to colleagues via peer-review is another critical tool to ensure the quality of our ongoing scientific visual communication. While editors could certainly provide guiding recommendations, it is also critical that scientifically derived colour maps are being applied already during the early diagnosis of the data, and not just applied for publication only. Set instructions by scientific journals or conference organisers could remind researchers to fulfil the graphical standards that science needs to be built upon. It might even be useful to limit researchers to using only a handful of hand-picked, suitable colour maps for specific types of data and data parameters to streamline and enhance data visualisation. This type of approach is being developed for the next assessment reports of the Intergovernmental Panel on Climate Change (IPCC), in collaboration with Melissa Gomis (Graphics and Science Communication officer, IPCC WGI Technical Support Unit, Université Paris-Saclay, France).

Presently, scientifically derived colour maps are easily accessible and applicable across various tools and platforms and suitable palettes exist for any given data (Box [2](/articles/s41467-020-19160-7#Sec3)). The open availability of such colour maps ultimately leaves little legitimate room to continue using colour maps that cause visual distortion, are unreadable in some circumstances, or exclude readers from understanding them.

The wider scientific community needs to accept that colour maps are a pivotal tool in scientific discovery, data visualisation and science communication. Non-scientific colour maps require scrutiny and rejection from the community to preserve academic integrity. The evidence is clear, there are no more reasons to continue using unscientific colour maps.

## Methods

### Defining colour spaces

Various methods and tools based on different metrics and colour spaces (Supplementary Note [4](/articles/s41467-020-19160-7#MOESM1)) exist to diagnose the uniformity of a colour palette (e.g., refs. [32](/articles/s41467-020-19160-7#ref-CR32 "Kovesi, P. Good colour maps: how to design them. CoRR abs/1509.03700 (2015). Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue."),[34](/articles/s41467-020-19160-7#ref-CR34 "Bujack, R. et al. The Good, the bad, and the ugly: a theoretical framework for the assessment of continuous colormaps. IEEE Trans. Vis. Computer Graph. 24, 923–933 (2018)."),[38](/articles/s41467-020-19160-7#ref-CR38 "Nuñez, J. R., Anderton, C. R. & Renslow, R. S. Optimizing colormaps with consideration for color vision deficiency to enable accurate interpretation of scientific data. PLoS ONE 13, e0199239 (2018). Developed the mathematically optimal colour map for readers with different colour-vision deficiencies named Cividis, which allows most accurate perception of data by as many viewers as possible.")). A widely used example is the International Commission on Illumination’s uniform colour space named CIELAB UCS[42](#ref-CR42 "Smith, T. & Guild, J. The CIE colorimetric standards and their use. Trans. Optical Soc. 33, 73 (1931)."),[43](#ref-CR43 "C. I. E. Technical Report Colorimetry. (Commission Internationale de l’Eclairage Central Bureau Vienna, Austria, 2004)."),[44](/articles/s41467-020-19160-7#ref-CR44 "CIE. Part 4: CIE 1976 L* a* b* Colour space, 
http://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space
(2011)."). CIELAB UCS (also abbreviated from Uniform/Unified Colour Scale, Chromaticity Scale, Chromaticity Space) describes the complete range of colours in a perceptually uniform rectangular coordinate system[45](/articles/s41467-020-19160-7#ref-CR45 "Hunter Associates Laboratory Inc. Brief Explanation of Delta E or Delta E*,
http://support.hunterlab.com/hc/en-us/articles/%20203023559-Brief-Explanation-of-delta-E-or-delta-E
-> (2019).") and allows the creation of perceptually uniform colour palettes[32](/articles/s41467-020-19160-7#ref-CR32 "Kovesi, P. Good colour maps: how to design them. CoRR abs/1509.03700 (2015). Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue."),[35](/articles/s41467-020-19160-7#ref-CR35 "Ware, C. et al. Measuring and modeling the feature detection threshold functions of colormaps. IEEE Trans. Vis. Computer Graph. 25, 2777–2790 (2019)."),[46](/articles/s41467-020-19160-7#ref-CR46 "Meier, B. J., Spalter, A. M. & Karelitz, D. B. Interactive color palette tools. IEEE Computer Graph. Appl. 24, 64–72 (2004)."),[47](/articles/s41467-020-19160-7#ref-CR47 "Moreland, K. in Advances in Visual Computing (eds George Bebis et al.) 92–103 (Springer Berlin Heidelberg, Berlin, Heidelberg, 2009).").

The colour appearance model CIECAM02[48](/articles/s41467-020-19160-7#ref-CR48 "Moroney, N. et al. in Color and Imaging Conference Vol. 2002 23–27 (2002)."),[49](/articles/s41467-020-19160-7#ref-CR49 "International Commission on Illumination. Technical Committee TC 8-01. in Colour Appearance Modeling for Colour Management Systems (2004)."), and the perceptually uniform colour space CIECAM02-UCS[50](/articles/s41467-020-19160-7#ref-CR50 "Luo, M. R., Cui, G. & Li, C. Uniform colour spaces based on CIECAM02 colour appearance model. Color Res. Appl. 31, 320–330 (2006).") based on it, is the current gold standard to describe how we perceive colour and colour differences. CIECAM02-UCS describes a certain colour by its lightness (L) and its red–green (a) and yellow-blue (b) correlates (Supplementary Figs. [4](/articles/s41467-020-19160-7#MOESM1) and [5](/articles/s41467-020-19160-7#MOESM1)), and it represents a certain perceptual colour variation on equal Euclidean distances across the whole space. Colour spaces like CIECAM02-UCS make it possible to design perceptually uniform colour maps and, also, to take colour-deficient vision into account.

Here, the CIELAB UCS colour difference metric Δ*ECIEDE* 2000[51](/articles/s41467-020-19160-7#ref-CR51 "Lindbloom, B. Delta E (CIE 1976). 
http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE76.html
(2019).") is used (Fig. [3a, b](/articles/s41467-020-19160-7#Fig3)) and allows the calculation of a local lightness gradient between two colours by

$$\\Delta {\\mathrm{E}\_{\\it{CIEDE}2000}} = \[(L\_1 - L\_2)^2 + (a\_1 - a\_2)^2 + (b\_1 - b\_2)^2\]^{1/2},$$

(1)

where _L_ is the lightness of one specific colour, and a its red–green and _b_ its yellow-blue correlative (Supplementary Figs. [4](/articles/s41467-020-19160-7#MOESM1) and [5](/articles/s41467-020-19160-7#MOESM1)). This lightness difference metric can be used to diagnose any colour map (e.g., ref. [20](/articles/s41467-020-19160-7#ref-CR20 "Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. True colors of oceanography: guidelines for effective and accurate colormap selection. Oceanography 29, 9–13 (2016). Introducing the scientifically derived cmocean colour maps for better data visualisation in oceanography that also underline the importance of intuitive colour palettes given a certain data parameter.")) and calculate the effective, perceptual error that is added to the underlying data by uneven colour gradients along a colour map[30](/articles/s41467-020-19160-7#ref-CR30 "Crameri, F. Geodynamic diagnostics, scientific visualisation and StagLab 3.0. Geoscientific Model Dev. 11, 2541–2562 (2018)."). These errors and the resulting visual data distortion can be significant and make, for example, linear data gradients look like a wobbly graph (Fig. [3](/articles/s41467-020-19160-7#Fig3)).

## Data availability

The scientific colour maps are openly available from ref. [41](/articles/s41467-020-19160-7#ref-CR41 "Crameri, F. Scientific Colour Maps, 
http://www.fabiocrameri.ch/colourmaps
(2020).") and archived on Zenodo[52](/articles/s41467-020-19160-7#ref-CR52 "Crameri, F. Scientific colour maps: perceptually uniform and colour-vision deficiency friendly. Zenodo, 
https://doi.org/10.5281/zenodo.1243862
(2018).") ([https://doi.org/10.5281/zenodo.1243862](https://doi.org/10.5281/zenodo.1243862)). All other additional information related to the article is provided in the Supplementary Information and Box [2](/articles/s41467-020-19160-7#Sec3).

## References

1.  Akiyama, K. et al. First M87 event horizon telescope results. IV. Imaging the central supermassive black hole. _Astrophys. J. Lett._ **875**, L4 (2019).

    [Article](https://doi.org/10.3847%2F2041-8213%2Fab0e85)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2019ApJ...875L...4E)  [CAS](/articles/cas-redirect/1:CAS:528:DC%2BC1MXhtlWltbjI)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=First%20M87%20event%20horizon%20telescope%20results.%20IV.%20Imaging%20the%20central%20supermassive%20black%20hole&journal=Astrophys.%20J.%20Lett.&doi=10.3847%2F2041-8213%2Fab0e85&volume=875&publication_year=2019&author=Akiyama%2CK) 

2.  Long, E. _Election Data Visualisation_ (University of Plymouth, 2013).

3.  Cox, A., Bostock, M., Watkins, D. & Shan, C. _The Most Detailed Maps You’ll See from the Midterm Elections_., [https://www.nytimes.com/interactive/2014/11/04/upshot/senate-maps.html](https://www.nytimes.com/interactive/2014/11/04/upshot/senate-maps.html) (2014).

4.  Lemoine, F. G. et al. An improved solution of the gravity field of Mars (GMM-2B) from Mars Global Surveyor. _J. Geophys. Res.: Planets_ **106**, 23359–23376 (2001).

    [Article](https://doi.org/10.1029%2F2000JE001426)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2001JGR...10623359L)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=An%20improved%20solution%20of%20the%20gravity%20field%20of%20Mars%20%28GMM-2B%29%20from%20Mars%20Global%20Surveyor&journal=J.%20Geophys.%20Res.%3A%20Planets&doi=10.1029%2F2000JE001426&volume=106&pages=23359-23376&publication_year=2001&author=Lemoine%2CFG) 

5.  Hawkins, E. Scrap rainbow colour scales. _Nature_ **519**, 291 EP (2015).

    [Article](https://doi.org/10.1038%2F519291d)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2015Natur.519..291H)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Scrap%20rainbow%20colour%20scales&journal=Nature&doi=10.1038%2F519291d&volume=519&publication_year=2015&author=Hawkins%2CE) 

6.  IPCC. _Global Warming of 1.5° C: An IPCC Special Report on the Impacts of Global Warming of 1.5° C Above Pre-industrial Levels and Related Global Greenhouse Gas Emission Pathways, in the Context of Strengthening the Global Response to the Threat of Climate Change, Sustainable Development, and Efforts to Eradicate Poverty_. (Intergovernmental Panel on Climate Change, 2018).

7.  Borkin, M. et al. Evaluation of artery visualizations for heart disease diagnosis. _IEEE Trans. Vis. Computer Graph._ **17**, 2479–2488 (2011).

    [Article](https://doi.org/10.1109%2FTVCG.2011.192)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Evaluation%20of%20artery%20visualizations%20for%20heart%20disease%20diagnosis&journal=IEEE%20Trans.%20Vis.%20Computer%20Graph.&doi=10.1109%2FTVCG.2011.192&volume=17&pages=2479-2488&publication_year=2011&author=Borkin%2CM) 

8.  McNeall, D. _How many Rainbows at EGU 2018_, <[https://betterfigures.org/2018/04/16/how-many-rainbows-at-egu-2018](https://betterfigures.org/2018/04/16/how-many-rainbows-at-egu-2018)\> (2020).

9.  Bertin, J. _Graphics and Graphic Information Processing_. (Walter de Gruyter, 2011).

10. Bertin, J. Semiology of graphics; diagrams networks maps. (University of Wisconsin, Press, Madison, 1983).

11. Tufte, E. R. _Envisioning Information_. Vol. 126 (Graphics Press, 1990).

12. Travis, D. _Effective Color Displays: Theory and Practice_. Vol. 1991 (Academic press London, 1991).

13. Brewer, C. A. Color use guidelines for mapping. _Vis. Mod. Cartogr._ **1994**, 123–148 (1994).

    [Article](https://doi.org/10.1016%2FB978-0-08-042415-6.50014-4)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Color%20use%20guidelines%20for%20mapping&journal=Vis.%20Mod.%20Cartogr.&doi=10.1016%2FB978-0-08-042415-6.50014-4&volume=1994&pages=123-148&publication_year=1994&author=Brewer%2CCA) 

14. MacEachren, A. M. _How Maps Work: Representation, Visualization, and Design_. (Guilford Press, 2004).

15. Dent, B. D., Torguson, J. S. & Hodler, T. W. _Cartography: Thematic Map Design_. Vol. 5 (WCB/McGraw-Hill New York, 1999).

16. Robinson, A. _Elements of Cartography_. (John Wiley and Sons, New York, 1960).

17. Monmonier, M. _How to Lie with Maps_ (University of Chicago Press, 2018).

18. Light, A. & Bartlein, P. J. The end of the rainbow? Color schemes for improved data graphics. _Eos Trans. AGU_ **85**, 385–391 (2004).

    [Article](https://doi.org/10.1029%2F2004EO400002)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2004EOSTr..85..385L)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=The%20end%20of%20the%20rainbow%3F%20Color%20schemes%20for%20improved%20data%20graphics&journal=Eos%20Trans.%20AGU&doi=10.1029%2F2004EO400002&volume=85&pages=385-391&publication_year=2004&author=Light%2CA&author=Bartlein%2CPJ) 

19. Stauffer, R., Mayr, G. J., Dabernig, M. & Zeileis, A. Somewhere over the rainbow: how to make effective use of colors in meteorological visualizations. _Bull. Am. Meteorological Soc._ **96**, 203–216 (2015).

    [Article](https://doi.org/10.1175%2FBAMS-D-13-00155.1)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2015BAMS...96..203S)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Somewhere%20over%20the%20rainbow%3A%20how%20to%20make%20effective%20use%20of%20colors%20in%20meteorological%20visualizations&journal=Bull.%20Am.%20Meteorological%20Soc.&doi=10.1175%2FBAMS-D-13-00155.1&volume=96&pages=203-216&publication_year=2015&author=Stauffer%2CR&author=Mayr%2CGJ&author=Dabernig%2CM&author=Zeileis%2CA) 

20. Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. True colors of oceanography: guidelines for effective and accurate colormap selection. _Oceanography_ **29**, 9–13 (2016). **_Introducing the scientifically derived cmocean colour maps for better data visualisation in oceanography that also underline the importance of intuitive colour palettes given a certain data parameter_**.

    [Article](https://doi.org/10.5670%2Foceanog.2016.66)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=True%20colors%20of%20oceanography%3A%20guidelines%20for%20effective%20and%20accurate%20colormap%20selection&journal=Oceanography&doi=10.5670%2Foceanog.2016.66&volume=29&pages=9-13&publication_year=2016&author=Thyng%2CKM&author=Greene%2CCA&author=Hetland%2CRD&author=Zimmerle%2CHM&author=DiMarco%2CSF) 

21. Cairo, A. _The Functional Art: An Introduction to Information Graphics and Visualization_. (New Riders, 2012).

22. Wolfe, J. M. & Horowitz, T. S. Five factors that guide attention in visual search. _Nat. Hum. Behav._ **1**, 0058 (2017).

    [Article](https://doi.org/10.1038%2Fs41562-017-0058)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Five%20factors%20that%20guide%20attention%20in%20visual%20search&journal=Nat.%20Hum.%20Behav.&doi=10.1038%2Fs41562-017-0058&volume=1&publication_year=2017&author=Wolfe%2CJM&author=Horowitz%2CTS) 

23. Alexander, K. R. & Shansky, M. S. Influence of hue, value, and chroma on the perceived heaviness of colors. _Percept. Psychophys._ **19**, 72–74 (1976).

    [Article](https://doi.org/10.3758%2FBF03199388)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Influence%20of%20hue%2C%20value%2C%20and%20chroma%20on%20the%20perceived%20heaviness%20of%20colors&journal=Percept.%20Psychophys.&doi=10.3758%2FBF03199388&volume=19&pages=72-74&publication_year=1976&author=Alexander%2CKR&author=Shansky%2CMS) 

24. Sharpe, L. T., Stockman, A., Jägle, H. & Nathans, J. _Opsin Genes, Cone Photopigments, Color Vision, and Color Blindness_. Vol. 351 (Cambridge University Press, 1999).

25. Neitz, J. & Neitz, M. The genetics of normal and defective color vision. _Vis. Res._ **51**, 633–651 (2011).

    [Article](https://doi.org/10.1016%2Fj.visres.2010.12.002)  [CAS](/articles/cas-redirect/1:CAS:528:DC%2BC3MXksFaqs7o%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=The%20genetics%20of%20normal%20and%20defective%20color%20vision&journal=Vis.%20Res.&doi=10.1016%2Fj.visres.2010.12.002&volume=51&pages=633-651&publication_year=2011&author=Neitz%2CJ&author=Neitz%2CM) 

26. Drummond-Borg, M., Deeb, S. S. & Motulsky, A. G. Molecular patterns of X chromosome-linked color vision genes among 134 men of European ancestry. _Proc. Natl Acad. Sci._ **86**, 983–987 (1989).

    [Article](https://doi.org/10.1073%2Fpnas.86.3.983)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=1989PNAS...86..983D)  [CAS](/articles/cas-redirect/1:CAS:528:DyaL1MXht12ktL0%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Molecular%20patterns%20of%20X%20chromosome-linked%20color%20vision%20genes%20among%20134%20men%20of%20European%20ancestry&journal=Proc.%20Natl%20Acad.%20Sci.&doi=10.1073%2Fpnas.86.3.983&volume=86&pages=983-987&publication_year=1989&author=Drummond-Borg%2CM&author=Deeb%2CSS&author=Motulsky%2CAG) 

27. Albrecht, M. Color blindness. _Nat. Methods_ **7**, 775 EP (2010).

    [Article](https://doi.org/10.1038%2Fnmeth1010-775a)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Color%20blindness&journal=Nat.%20Methods&doi=10.1038%2Fnmeth1010-775a&volume=7&publication_year=2010&author=Albrecht%2CM) 

28. Wong, B. Reply to \\“More on color blindness\\“. _Nat. Methods_ **8**, 891 EP (2011).

    [Article](https://doi.org/10.1038%2Fnmeth.1738)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Reply%20to%20%5C%E2%80%9CMore%20on%20color%20blindness%5C%E2%80%9C&journal=Nat.%20Methods&doi=10.1038%2Fnmeth.1738&volume=8&publication_year=2011&author=Wong%2CB) 

29. Moreland, K. Why we use bad color maps and what you can do about it. _Electron. Imaging_ **2016**, 1–6 (2016). **_The widespread use of the rainbow is the main reason scientists propagate it further, which must therefore be considered if a scientific alternative is to be effective_**.

    [Article](https://doi.org/10.2352%2FISSN.2470-1173.2016.16.HVEI-133)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Why%20we%20use%20bad%20color%20maps%20and%20what%20you%20can%20do%20about%20it&journal=Electron.%20Imaging&doi=10.2352%2FISSN.2470-1173.2016.16.HVEI-133&volume=2016&pages=1-6&publication_year=2016&author=Moreland%2CK) 

30. Crameri, F. Geodynamic diagnostics, scientific visualisation and StagLab 3.0. _Geoscientific Model Dev._ **11**, 2541–2562 (2018).

    [Article](https://doi.org/10.5194%2Fgmd-11-2541-2018)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=2018GMD....11.2541C)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Geodynamic%20diagnostics%2C%20scientific%20visualisation%20and%20StagLab%203.0&journal=Geoscientific%20Model%20Dev.&doi=10.5194%2Fgmd-11-2541-2018&volume=11&pages=2541-2562&publication_year=2018&author=Crameri%2CF) 

31. Silva, S., Sousa Santos, B. & Madeira, J. Using color in visualization: a survey. _Computer Graph._ **35**, 320–333 (2011).

    [Article](https://doi.org/10.1016%2Fj.cag.2010.11.015)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Using%20color%20in%20visualization%3A%20a%20survey&journal=Computer%20Graph.&doi=10.1016%2Fj.cag.2010.11.015&volume=35&pages=320-333&publication_year=2011&author=Silva%2CS&author=Sousa%20Santos%2CB&author=Madeira%2CJ) 

32. Kovesi, P. Good colour maps: how to design them. _CoRR_ abs/1509.03700 (2015). **_Provides a set of colour map diagnostics and shows that the most important factor designing a colour map is perceptually uniform lightness, allowing to construct more consistent and reliable ternary base colours to replace the problematic RGB primaries red, green, and blue_**.

33. Szafir, D. A. Modeling color difference for visualization design. _IEEE Trans. Vis. Computer Graph._ **24**, 392–401 (2018).

    [Article](https://doi.org/10.1109%2FTVCG.2017.2744359)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Modeling%20color%20difference%20for%20visualization%20design&journal=IEEE%20Trans.%20Vis.%20Computer%20Graph.&doi=10.1109%2FTVCG.2017.2744359&volume=24&pages=392-401&publication_year=2018&author=Szafir%2CDA) 

34. Bujack, R. et al. The Good, the bad, and the ugly: a theoretical framework for the assessment of continuous colormaps. _IEEE Trans. Vis. Computer Graph._ **24**, 923–933 (2018).

    [Article](https://doi.org/10.1109%2FTVCG.2017.2743978)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=The%20Good%2C%20the%20bad%2C%20and%20the%20ugly%3A%20a%20theoretical%20framework%20for%20the%20assessment%20of%20continuous%20colormaps&journal=IEEE%20Trans.%20Vis.%20Computer%20Graph.&doi=10.1109%2FTVCG.2017.2743978&volume=24&pages=923-933&publication_year=2018&author=Bujack%2CR) 

35. Ware, C. et al. Measuring and modeling the feature detection threshold functions of colormaps. _IEEE Trans. Vis. Computer Graph._ **25**, 2777–2790 (2019).

    [Article](https://doi.org/10.1109%2FTVCG.2018.2855742)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Measuring%20and%20modeling%20the%20feature%20detection%20threshold%20functions%20of%20colormaps&journal=IEEE%20Trans.%20Vis.%20Computer%20Graph.&doi=10.1109%2FTVCG.2018.2855742&volume=25&pages=2777-2790&publication_year=2019&author=Ware%2CC) 

36. Zeller, S. & Rogers, D. Visualizing science: How color determines what we see. _Eos Trans. AGU_ Vol. 101 (American Geophysical Union, 2020). [https://doi.org/10.1029/2020EO144330](https://doi.org/10.1029/2020EO144330)

37. Mikhailov, A. in _Google AI Blog_ Vol. 2020 (Google, [https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html](https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html), 2019).

38. Nuñez, J. R., Anderton, C. R. & Renslow, R. S. Optimizing colormaps with consideration for color vision deficiency to enable accurate interpretation of scientific data. _PLoS ONE_ **13**, e0199239 (2018). **_Developed the mathematically optimal colour map for readers with different colour-vision deficiencies named Cividis, which allows most accurate perception of data by as many viewers as possible_**.

    [Article](https://doi.org/10.1371%2Fjournal.pone.0199239)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Optimizing%20colormaps%20with%20consideration%20for%20color%20vision%20deficiency%20to%20enable%20accurate%20interpretation%20of%20scientific%20data&journal=PLoS%20ONE&doi=10.1371%2Fjournal.pone.0199239&volume=13&publication_year=2018&author=Nu%C3%B1ez%2CJR&author=Anderton%2CCR&author=Renslow%2CRS) 

39. Hawkins, E. ([http://www.climate-lab-book.ac.uk/2018/2018-visualisation-update/](http://www.climate-lab-book.ac.uk/2018/2018-visualisation-update/), 2019).

40. Wong, B. Color coding. _Nat. Methods_ **7**, 573 EP (2010).

    [Article](https://doi.org/10.1038%2Fnmeth0810-573)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Color%20coding&journal=Nat.%20Methods&doi=10.1038%2Fnmeth0810-573&volume=7&publication_year=2010&author=Wong%2CB) 

41. Crameri, F. _Scientific Colour Maps_, [http://www.fabiocrameri.ch/colourmaps](http://www.fabiocrameri.ch/colourmaps) (2020).

42. Smith, T. & Guild, J. The CIE colorimetric standards and their use. _Trans. Optical Soc._ **33**, 73 (1931).

    [Article](https://doi.org/10.1088%2F1475-4878%2F33%2F3%2F301)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=1931TrOS...33...73S)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=The%20CIE%20colorimetric%20standards%20and%20their%20use&journal=Trans.%20Optical%20Soc.&doi=10.1088%2F1475-4878%2F33%2F3%2F301&volume=33&publication_year=1931&author=Smith%2CT&author=Guild%2CJ) 

43. C. I. E. Technical Report Colorimetry. (Commission Internationale de l’Eclairage Central Bureau Vienna, Austria, 2004).

44. CIE. _Part 4: CIE 1976 L\* a\* b\* Colour space_, [http://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space](http://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space) (2011).

45. Hunter Associates Laboratory Inc. _Brief Explanation of Delta E or Delta_ _E\*_,[http://support.hunterlab.com/hc/en-us/articles/%20203023559-Brief-Explanation-of-delta-E-or-delta-E](https://support.hunterlab.com/hc/en-us/articles/%20203023559-Brief-Explanation-of-delta-E-or-delta-E)\-> (2019).

46. Meier, B. J., Spalter, A. M. & Karelitz, D. B. Interactive color palette tools. _IEEE Computer Graph. Appl._ **24**, 64–72 (2004).

    [Article](https://doi.org/10.1109%2FMCG.2004.1297012)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Interactive%20color%20palette%20tools&journal=IEEE%20Computer%20Graph.%20Appl.&doi=10.1109%2FMCG.2004.1297012&volume=24&pages=64-72&publication_year=2004&author=Meier%2CBJ&author=Spalter%2CAM&author=Karelitz%2CDB) 

47. Moreland, K. in _Advances in Visual Computing_ (eds George Bebis et al.) 92–103 (Springer Berlin Heidelberg, Berlin, Heidelberg, 2009).

48. Moroney, N. et al. in _Color and Imaging Conference_ Vol. 2002 23–27 (2002).

49. International Commission on Illumination. Technical Committee TC 8-01. in _Colour Appearance Modeling for Colour Management Systems_ (2004).

50. Luo, M. R., Cui, G. & Li, C. Uniform colour spaces based on CIECAM02 colour appearance model. _Color Res. Appl._ **31**, 320–330 (2006).

    [Article](https://doi.org/10.1002%2Fcol.20227)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Uniform%20colour%20spaces%20based%20on%20CIECAM02%20colour%20appearance%20model&journal=Color%20Res.%20Appl.&doi=10.1002%2Fcol.20227&volume=31&pages=320-330&publication_year=2006&author=Luo%2CMR&author=Cui%2CG&author=Li%2CC) 

51. Lindbloom, B. _Delta E (CIE 1976)_. [http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE76.html](http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE76.html) (2019).

52. Crameri, F. Scientific colour maps: perceptually uniform and colour-vision deficiency friendly. _Zenodo_, [https://doi.org/10.5281/zenodo.1243862](https://doi.org/10.5281/zenodo.1243862) (2018).

53. Crameri, F. DiVA: effective design for any MatLab figure. _Zenodo_, [https://doi.org/10.5281/zenodo.3596368](https://doi.org/10.5281/zenodo.3596368) (2020).

54. Curcio, C. A. et al. Distribution and morphology of human cone photoreceptors stained with anti‐blue opsin. _J. Comp. Neurol._ **312**, 610–624 (1991).

    [Article](https://doi.org/10.1002%2Fcne.903120411)  [CAS](/articles/cas-redirect/1:STN:280:DyaK387gsFCksQ%3D%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Distribution%20and%20morphology%20of%20human%20cone%20photoreceptors%20stained%20with%20anti%E2%80%90blue%20opsin&journal=J.%20Comp.%20Neurol.&doi=10.1002%2Fcne.903120411&volume=312&pages=610-624&publication_year=1991&author=Curcio%2CCA) 

55. Meyer, G. W. & Greenberg, D. P. Color-defective vision and computer graphics displays. _IEEE Computer Graph. Appl._ **8**, 28–40 (1988).

    [Article](https://doi.org/10.1109%2F38.7759)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Color-defective%20vision%20and%20computer%20graphics%20displays&journal=IEEE%20Computer%20Graph.%20Appl.&doi=10.1109%2F38.7759&volume=8&pages=28-40&publication_year=1988&author=Meyer%2CGW&author=Greenberg%2CDP) 

56. Lennie, P., Pokorny, J. & Smith, V. C. Luminance. _J. Optical Soc. Am. A: Opt. Image Sci., Vis._ **10**, 1283–1293 (1993).

    [Article](https://doi.org/10.1364%2FJOSAA.10.001283)  [ADS](http://adsabs.harvard.edu/cgi-bin/nph-data_query?link_type=ABSTRACT&bibcode=1993JOSAA..10.1283L)  [CAS](/articles/cas-redirect/1:CAS:528:DyaK3sXmtlKqtrs%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Luminance&journal=J.%20Optical%20Soc.%20Am.%20A%3A%20Opt.%20Image%20Sci.%2C%20Vis.&doi=10.1364%2FJOSAA.10.001283&volume=10&pages=1283-1293&publication_year=1993&author=Lennie%2CP&author=Pokorny%2CJ&author=Smith%2CVC) 

57. Kaiser, P. & Boynton, R. _Human Color Vision_. 2nd edn, (Optical Society of America, 1996).

58. Roorda, A., Metha, A. B., Lennie, P. & Williams, D. R. Packing arrangement of the three cone classes in primate retina. _Vis. Res._ **41**, 1291–1306 (2001).

    [Article](https://doi.org/10.1016%2FS0042-6989%2801%2900043-8)  [CAS](/articles/cas-redirect/1:STN:280:DC%2BD3Mzis1Cjuw%3D%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Packing%20arrangement%20of%20the%20three%20cone%20classes%20in%20primate%20retina&journal=Vis.%20Res.&doi=10.1016%2FS0042-6989%2801%2900043-8&volume=41&pages=1291-1306&publication_year=2001&author=Roorda%2CA&author=Metha%2CAB&author=Lennie%2CP&author=Williams%2CDR) 

59. Lafer-Sousa, R., Hermann, K. L. & Conway, B. R. Striking individual differences in color perception uncovered by ‘the dress’ photograph. _Curr. Biol._ **25**, R545–R546 (2015).

    [Article](https://doi.org/10.1016%2Fj.cub.2015.04.053)  [CAS](/articles/cas-redirect/1:CAS:528:DC%2BC2MXosVaqs7o%3D)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Striking%20individual%20differences%20in%20color%20perception%20uncovered%20by%20%E2%80%98the%20dress%E2%80%99%20photograph&journal=Curr.%20Biol.&doi=10.1016%2Fj.cub.2015.04.053&volume=25&pages=R545-R546&publication_year=2015&author=Lafer-Sousa%2CR&author=Hermann%2CKL&author=Conway%2CBR) 

60. Emery, K. J. & Webster, M. A. Individual differences and their implications for color perception. _Curr. Opin. Behav. Sci._ **30**, 28–33 (2019).

    [Article](https://doi.org/10.1016%2Fj.cobeha.2019.05.002)  [Google Scholar](http://scholar.google.com/scholar_lookup?&title=Individual%20differences%20and%20their%20implications%20for%20color%20perception&journal=Curr.%20Opin.%20Behav.%20Sci.&doi=10.1016%2Fj.cobeha.2019.05.002&volume=30&pages=28-33&publication_year=2019&author=Emery%2CKJ&author=Webster%2CMA) 

61. Brewer, C. A. _Colorbrewer Colour Maps_, [https://colorbrewer2.org/](https://colorbrewer2.org/) (2020).

62. van der Walt, S. & Smith, N. _MPL Colour Maps_, [https://bids.github.io/colormap](https://bids.github.io/colormap) (2020).

63. Nuñez, J. R., Anderton, C. R. & Renslow, R. S. _Cividis colour map_, _PLoS ONE_, https://www.doi.org/10.1371/journal.pone.0199239.s002 (2020).

64. Thyng, K. M., Greene, C. A., Hetland, R. D., Zimmerle, H. M. & DiMarco, S. F. _CMOcean Colour Maps_, [http://matplotlib.org/cmocean](http://matplotlib.org/cmocean) (2020).

65. Kovesi, P. _CET Colour Maps_, [http://peterkovesi.com/projects/colourmaps](http://peterkovesi.com/projects/colourmaps) (2020).

[Download references](https://citation-needed.springer.com/v2/references/10.1038/s41467-020-19160-7?format=refman&flavour=references)

## Acknowledgements

We thank Melissa Gomis for valuable feedback on the user guide and Stefan Scherrer for contributing the Supplementary Movie [1](/articles/s41467-020-19160-7#MOESM4). The open-access figure design routine DiVA[53](/articles/s41467-020-19160-7#ref-CR53 "Crameri, F. DiVA: effective design for any MatLab figure. Zenodo, 
https://doi.org/10.5281/zenodo.3596368
(2020).") was used. F.C. and G.E.S. acknowledge support from the Research Council of Norway through its Centres of Excellence funding scheme, Project Number 223272. P.J.H. receives funding from the European Union’s Horizon 2020 research and innovation programme under the Marie Skłodowska-Curie Grant Agreement 749664.

## Author information

### Authors and Affiliations

1.  Centre for Earth Evolution and Dynamics (CEED), University of Oslo, Postbox 1028, Blindern, 0315, Oslo, Norway

    Fabio Crameri & Grace E. Shephard

2.  Department of Earth Sciences, Durham University, Durham, UK

    Philip J. Heron

Authors

1.  Fabio Crameri

    [View author publications](/search?author=Fabio%20Crameri)

    Search author on:[PubMed](https://www.ncbi.nlm.nih.gov/entrez/query.fcgi?cmd=search&term=Fabio%20Crameri) [Google Scholar](https://scholar.google.co.uk/scholar?as_q=&num=10&btnG=Search+Scholar&as_epq=&as_oq=&as_eq=&as_occt=any&as_sauthors=%22Fabio%20Crameri%22&as_publication=&as_ylo=&as_yhi=&as_allsubj=all&hl=en)

2.  Grace E. Shephard

    [View author publications](/search?author=Grace%20E.%20Shephard)

    Search author on:[PubMed](https://www.ncbi.nlm.nih.gov/entrez/query.fcgi?cmd=search&term=Grace%20E.%20Shephard) [Google Scholar](https://scholar.google.co.uk/scholar?as_q=&num=10&btnG=Search+Scholar&as_epq=&as_oq=&as_eq=&as_occt=any&as_sauthors=%22Grace%20E.%20Shephard%22&as_publication=&as_ylo=&as_yhi=&as_allsubj=all&hl=en)

3.  Philip J. Heron

    [View author publications](/search?author=Philip%20J.%20Heron)

    Search author on:[PubMed](https://www.ncbi.nlm.nih.gov/entrez/query.fcgi?cmd=search&term=Philip%20J.%20Heron) [Google Scholar](https://scholar.google.co.uk/scholar?as_q=&num=10&btnG=Search+Scholar&as_epq=&as_oq=&as_eq=&as_occt=any&as_sauthors=%22Philip%20J.%20Heron%22&as_publication=&as_ylo=&as_yhi=&as_allsubj=all&hl=en)

### Contributions

F.C. designed the Scientific colour maps and the figures, G.E.S. contributed to the development and software compatibility of the Scientific colour maps, P.J.H. designed the outreach poster. All authors conceived the study, evaluated the use of and promoted scientifically derived colour maps, and contributed to the scientific discussion and preparation of the manuscript.

### Corresponding author

Correspondence to Fabio Crameri ([redacted]).

## Ethics declarations

### Competing interests

The authors declare no competing interests.

## Additional information

**Publisher’s note** Springer Nature remains neutral with regard to jurisdictional claims in published maps and institutional affiliations.

## Supplementary information

### [Supplementary Information (download PDF )](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_MOESM1_ESM.pdf)

### [Description of Additional Supplementary Files (download PDF )](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_MOESM2_ESM.pdf)

### [Supplementary Data 1 (download PDF )](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_MOESM3_ESM.pdf)

### [Supplementary Movie 1 (download MP4 )](https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-020-19160-7/MediaObjects/41467_2020_19160_MOESM4_ESM.mp4)

## Rights and permissions

**Open Access** This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original author(s) and the source, provide a link to the Creative Commons license, and indicate if changes were made. The images or other third party material in this article are included in the article’s Creative Commons license, unless indicated otherwise in a credit line to the material. If material is not included in the article’s Creative Commons license and your intended use is not permitted by statutory regulation or exceeds the permitted use, you will need to obtain permission directly from the copyright holder. To view a copy of this license, visit [http://creativecommons.org/licenses/by/4.0/](http://creativecommons.org/licenses/by/4.0/).

[Reprints and permissions](https://s100.copyright.com/AppDispatchServlet?title=The%20misuse%20of%20colour%20in%20science%20communication&author=Fabio%20Crameri%20et%20al&contentID=10.1038%2Fs41467-020-19160-7&copyright=The%20Author%28s%29&publication=2041-1723&publicationDate=2020-10-28&publisherName=SpringerNature&orderBeanReset=true&oa=CC%20BY)
