import datetime
import json
import logging
import numpy as np
import os
import re
import random
import spacy
import spacy.util
import torch
from pathlib import Path
from spacy.cli import download
from spacy.matcher import Matcher
from spacy.training import Example
from tqdm import tqdm
from transformers import RobertaTokenizer, RobertaForSequenceClassification

class CombinedAnalyzer:
    def __init__(self):
        """Initialize the CombinedAnalyzer with required models and components"""
        self.logger = logging.getLogger(__name__)
        self.ensure_model_downloaded()
        # Create spaCy model with all necessary components
        self.nlp = spacy.load("en_core_web_sm", disable=["ner"])  # Disable NER for faster processing
        # Configure pipeline components
        if "tagger" not in self.nlp.pipe_names:
            self.nlp.add_pipe("tagger", before="parser")
        
        if "attribute_ruler" not in self.nlp.pipe_names:
            self.nlp.add_pipe("attribute_ruler", after="tagger")
        
        # Check for fine-tuned model and load if available
        self.load_fine_tuned_model()

        # Load sentiment keywords from JSON file
        self.positive_keywords, self.negative_keywords = self.load_sentiment_keywords()

        # Configure attribute ruler patterns
        ruler = self.nlp.get_pipe("attribute_ruler")
        patterns = [
            {"patterns": [[{"ORTH": "rust"}]], "attrs": {"TAG": "NN"}},
            {"patterns": [[{"ORTH": "mildew"}]], "attrs": {"TAG": "NN"}},
            {"patterns": [[{"ORTH": "wheat"}]], "attrs": {"TAG": "NN"}},
            {"patterns": [[{"ORTH": "barley"}]], "attrs": {"TAG": "NN"}},
            {"patterns": [[{"ORTH": "disease"}]], "attrs": {"TAG": "NN"}},
            {"patterns": [[{"ORTH": "infection"}]], "attrs": {"TAG": "NN"}}
        ]
        for pattern in patterns:
            ruler.add(pattern["patterns"], pattern["attrs"])
        
        # Initialize and configure the matcher with patterns
        self.matcher = Matcher(self.nlp.vocab)
        self.add_matcher_patterns()
        
        # Log pipeline information
        self.logger.info("Active pipeline components: %s", self.nlp.pipe_names)
        
        # Agricultural-specific stopwords
        self.agri_stopwords = {"field", "farm", "crop", "plant", "seed", "grow", "harvest"}
        
    def add_matcher_patterns(self):
        """Add patterns to the matcher for identifying agricultural terms and diseases"""
        # Disease patterns
        disease_pattern = [
            [{"LOWER": {"IN": ["rust", "mildew", "smut", "blight", "rot", "spot", "mosaic", "wilt", "canker", "scab"]}}],
            [{"LOWER": "powdery"}, {"LOWER": "mildew"}],
            [{"LOWER": "leaf"}, {"LOWER": "spot"}],
            [{"LOWER": "stem"}, {"LOWER": "rust"}],
            [{"LOWER": "black"}, {"LOWER": "leg"}],
            [{"LOWER": "root"}, {"LOWER": "rot"}]
        ]
        
        # Crop patterns
        crop_pattern = [
            [{"LOWER": {"IN": ["wheat", "barley", "corn", "rice", "soybean", "cotton", "canola", "oats"]}}],
            [{"LOWER": {"IN": ["chickpea", "lentil", "lupin", "faba", "mungbean", "safflower", "sorghum"]}}]
        ]
        
        # Symptom patterns
        symptom_pattern = [
            [{"LOWER": {"IN": ["wilting", "yellowing", "spotting", "lesion", "chlorosis", "necrosis"]}}],
            [{"LOWER": "leaf"}, {"LOWER": {"IN": ["curl", "spot", "wilt", "burn"]}}],
            [{"LOWER": "stem"}, {"LOWER": {"IN": ["canker", "rot", "lesion"]}}],
            [{"LOWER": "root"}, {"LOWER": {"IN": ["rot", "damage", "lesion"]}}]
        ]
        
        # Seasonal terms patterns
        seasonal_pattern = [
            # Months
            [{"LOWER": {"IN": ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]}}],
            # Seasons
            [{"LOWER": {"IN": ["spring", "summer", "autumn", "fall", "winter"]}}],
            # Growing seasons
            [{"LOWER": {"IN": ["planting", "growing", "harvesting", "dormant", "flowering", "ripening"]}}],
            # Weather conditions
            [{"LOWER": {"IN": ["rainy", "dry", "wet", "humid", "frost", "drought", "flood"]}}],
            # Time periods
            [{"LOWER": {"IN": ["early", "mid", "late"]}}, {"LOWER": {"IN": ["season", "spring", "summer", "autumn", "fall", "winter"]}}]
        ]
        
        # Add patterns to matcher
        self.matcher.add("DISEASE", disease_pattern)
        self.matcher.add("CROP", crop_pattern)
        self.matcher.add("SYMPTOM", symptom_pattern)
        self.matcher.add("SEASONAL", seasonal_pattern)
        
        self.logger.info("Matcher patterns configured for diseases, crops, and symptoms")

    def ensure_model_downloaded(self):
        """Ensure the required spaCy model is downloaded"""
        try:
            spacy.load("en_core_web_sm")
        except OSError:
            self.logger.info("Downloading required model...")
            download("en_core_web_sm")

    def load_sentiment_keywords(self):
        """Load sentiment keywords from JSON file"""
        keywords_file = "preprocessing/roberta_sentiment_keywords.json"
        try:
            with open(keywords_file, 'r', encoding='utf-8') as file:
                keywords_data = json.load(file)
                if not keywords_data:  # Handle empty file
                    self.logger.error("Error: File %s is empty.", keywords_file)
                    return (
                        {"healthy": 0.25, "disease-free": 0.2, "thriving":0.15, "robust":0.15, "vigorous": 0.15},
                        {"infected": -0.2, "diseased": -0.2, "unhealthy": -0.15, "sickly": -0.2, "weak": 0.10, "outbreak": -0.3, "pest infestation": -0.3}        
                    )
                return (
                    keywords_data.get("positive_keywords", {}),
                    keywords_data.get("negative_keywords", {})
                )
        except FileNotFoundError:
            self.logger.error("Error: File %s not found.", keywords_file)
            return (
                {"healthy": 0.25, "disease-free": 0.2, "thriving":0.15, "robust":0.15, "vigorous": 0.15},
                {"infected": -0.2, "diseased": -0.2, "unhealthy": -0.15, "sickly": -0.2, "weak": 0.10, "outbreak": -0.3, "pest infestation": -0.3}        
            )
        except json.JSONDecodeError:
            self.logger.error("Error: File %s is not in valid JSON format.", keywords_file)
            return (
                {"healthy": 0.25, "disease-free": 0.2, "thriving":0.15, "robust":0.15, "vigorous": 0.15},
                {"infected": -0.2, "diseased": -0.2, "unhealthy": -0.15, "sickly": -0.2, "weak": 0.10, "outbreak": -0.3, "pest infestation": -0.3}        
            )
        except Exception as e:
            self.logger.error("Error loading sentiment keywords: %s", str(e))
            return (
                {"healthy": 0.25, "disease-free": 0.2, "thriving":0.15, "robust":0.15, "vigorous": 0.15},
                {"infected": -0.2, "diseased": -0.2, "unhealthy": -0.15, "sickly": -0.2, "weak": 0.10, "outbreak": -0.3, "pest infestation": -0.3}        
            )

    def load_fine_tuned_model(self):
        """Load fine-tuned RoBERTa model from Hugging Face Hub"""
        try:
            self.logger.info("Loading fine-tuned RoBERTa model from Hugging Face Hub")
            self.roberta_tokenizer = RobertaTokenizer.from_pretrained("group21/agricultural-sentiment-model")
            self.roberta_model = RobertaForSequenceClassification.from_pretrained("group21/agricultural-sentiment-model")
            self.logger.info("Successfully loaded fine-tuned model from Hub")
        except Exception as e:
            self.logger.error("Error loading fine-tuned model: %s. Using default model instead.", str(e))
            self.roberta_tokenizer = RobertaTokenizer.from_pretrained("cardiffnlp/twitter-roberta-base-sentiment") 
            self.roberta_model = RobertaForSequenceClassification.from_pretrained("cardiffnlp/twitter-roberta-base-sentiment")
        
    def preprocess_text(self, text):
        """Preprocess the input text"""
        if text is None:
            text = ""
            
        # Basic text cleaning
        text = text.lower().strip()
        
        # Remove URLs
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        
        # Remove hashtags and mentions
        text = re.sub(r'[@#]\w+', '', text)
        
        # Remove special characters and emojis
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        try:
            # Process with spaCy
            doc = self.nlp(text)
            
            # Tokenize and clean tokens
            tokens = []
            processed_words = []
            for token in doc:
                # Skip whitespace tokens
                if token.is_space:
                    continue
                # Skip stopwords (includes articles like 'the' and pronouns like 'it')
                if token.is_stop:
                    continue
                # Skip agricultural stopwords
                if token.text in self.agri_stopwords:
                    continue
                # Skip tokens that are just numbers
                if token.like_num:
                    continue
                # Skip single-character tokens
                if len(token.text) <= 1:
                    continue
                # Skip tokens that look like URLs or special characters
                if re.match(r'^[^\w\s]+$', token.text):
                    continue
                # Skip tokens that look like hashtags or mentions
                if re.match(r'^[@#]', token.text):
                    continue
                # Add cleaned token
                tokens.append(token.text)
                processed_words.append(token.text)
            
            # Create processed text without stopwords
            processed_text = ' '.join(processed_words)
            
            # Extract agricultural terms
            agricultural_terms = []
            for match_id, start, end in self.matcher(doc):
                span = doc[start:end]
                agricultural_terms.append({
                    "text": span.text,
                    "label": self.nlp.vocab.strings[match_id],
                    "start": start,
                    "end": end
                })
            
            return {
                "processed_text": processed_text,
                "tokens": tokens,
                "agricultural_terms": agricultural_terms,
                "doc": doc
            }
        except Exception as e:
            self.logger.error(f"Error in text preprocessing: {str(e)}")
            return {
                "processed_text": text,
                "tokens": [],
                "agricultural_terms": [],
                "doc": None
            }
        # Process with spaCy
        doc = self.nlp(text)

        
        # Define evaluative words to preserve
        evaluative_words = {
            # Basic evaluative words
            'good', 'bad', 'worse', 'worst', 'well', 'better', 'best',
            # Positive agricultural terms
            'healthy', 'thriving', 'robust', 'vigorous', 'strong', 'productive',
            # Negative agricultural terms
            'unhealthy', 'weak', 'poor', 'damaged', 'infected', 'diseased',
            # Comparative terms
            'more', 'less', 'most', 'least', 'greater', 'smaller',
            # Intensity words
            'very', 'extremely', 'highly', 'slightly', 'somewhat',
            # Temporal evaluative words
            'improving', 'declining', 'increasing', 'decreasing',
            # Quality indicators
            'excellent', 'outstanding', 'superior', 'inferior', 'adequate',
            # Status indicators
            'normal', 'abnormal', 'typical', 'atypical', 'standard',
            # Growth-related
            'growing', 'developing', 'mature', 'immature', 'ripe', 'unripe'
        }


    def analyze_text(self, text):
        """Analyze text for sentiment and agricultural terms"""
        # Preprocess text
        preprocessed = self.preprocess_text(text)
        processed_text = preprocessed["processed_text"]
        
        # Get sentiment analysis
        sentiment_results = self.sentiment_analysis(processed_text)
        
        # Extract entities
        entities = self.extract_entities(processed_text)
        
        return {
            "sentiment": sentiment_results,
            "entities": entities,
            "processed_text": processed_text,
            "agricultural_terms": preprocessed["agricultural_terms"]
        }

    def extract_entities(self, text):
        """Extract entities and return JSON-serializable results"""
        # Preprocess text to get the doc and agricultural terms
        preprocessed = self.preprocess_text(text)
        doc = preprocessed["doc"]
        entities = []
        
        if doc is not None:
            # Extract named entities
            for ent in doc.ents:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char
                })
        
        # Add agricultural terms from the matcher
        entities.extend(preprocessed["agricultural_terms"])
        
        return entities

    def sentiment_analysis(self, text):
        """
        Perform Sentiment Analysis using RoBERTa model with chunk processing for long texts
        Args:
            text (str): The input text to analyze
        Returns:
            dict: formatted sentiment score
        """
        # Check if text is long enough to require chunking
        # A good estimate for the token limit based on your error message (514 tokens)
        # Since tokens are typically shorter than words, this is a conservative estimate
        if len(text.split()) < 400:  # Safe margin for token limit
            return self._analyze_single_chunk(text)
        else:
            return self._analyze_multiple_chunks(text)
    
    def _analyze_single_chunk(self, text):
        """Process a single text chunk that fits within model limits"""
        # Tokenize the text with truncation
        input = self.roberta_tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        
        with torch.no_grad():
            # Perform forward pass
            output = self.roberta_model(**input)

        # Get the predicted sentiment
        sentiment = torch.softmax(output.logits, dim=-1)
        score = sentiment[0].tolist()

        # Get the enhanced sentiment score
        new_score = self.sentiment_score_refinement(text, score)
        new_score = [round(score, 5) for score in new_score]

        # Get the sentiment score
        negative_score = new_score[0]
        neutral_score = new_score[1]
        positive_score = new_score[2]

        # Improved compound score calculation
        compound = positive_score - negative_score

        # Determine overall sentiment
        if compound > 0.50:
            sentiment_label = "Positive"
        elif 0.10 < compound < 0.50:
            sentiment_label = "Slightly Positive"
        elif -0.10 < compound < 0.10:
            sentiment_label = "Neutral"
        elif -0.50 < compound < -0.10:
            sentiment_label = "Slightly Negative"
        else: 
            sentiment_label = "Negative"
        
        # Calculate leaning
        if compound > 0:
            lean_percentage = round((compound / 1) * 100)
            lean_result = {
                "direction": "Positive",
                "percentage": lean_percentage
            }
        elif compound < 0:
            lean_percentage = round((abs(compound) / 1) * 100)
            lean_result = {
                "direction": "Negative",
                "percentage": lean_percentage
            }
        else:
            lean_result = {
                "direction": "Balanced",
                "percentage": 0
            }
    
        # Format the results
        formatted_score = {
            "positive": positive_score,
            "negative": negative_score,
            "neutral": neutral_score,
            "compound": compound,
            "sentiment": sentiment_label,
            "neutral_leaning": lean_result
        }

        return formatted_score

    def _analyze_multiple_chunks(self, text):
        """Process a long text by splitting into chunks and combining the results"""
        # Split the text into chunks
        chunks = self._split_text_into_chunks(text)
        
        # Initialize aggregate scores
        chunk_scores = []
        total_words = sum(len(chunk.split()) for chunk in chunks)
        
        # Analyze each chunk
        for chunk in chunks:
            if not chunk.strip():
                continue
                
            # Get sentiment for this chunk
            chunk_result = self._analyze_single_chunk(chunk)
            
            # Weight by chunk size (number of words)
            chunk_weight = len(chunk.split()) / total_words
            
            chunk_scores.append({
                "score": chunk_result,
                "weight": chunk_weight
            })
        
        # Combine weighted scores
        combined_positive = sum(item["score"]["positive"] * item["weight"] for item in chunk_scores)
        combined_negative = sum(item["score"]["negative"] * item["weight"] for item in chunk_scores)
        combined_neutral = sum(item["score"]["neutral"] * item["weight"] for item in chunk_scores)
        
        # Ensure they sum to 1
        total = combined_positive + combined_negative + combined_neutral
        if total != 1.0 and total > 0:
            combined_positive /= total
            combined_negative /= total
            combined_neutral /= total
        
        # Calculate compound score
        compound = combined_positive - combined_negative
        
        # Determine overall sentiment based on combined scores
        if compound > 0.50:
            sentiment_label = "Positive"
        elif 0.10 < compound < 0.50:
            sentiment_label = "Slightly Positive"
        elif -0.10 < compound < 0.10:
            sentiment_label = "Neutral"
        elif -0.50 < compound < -0.10:
            sentiment_label = "Slightly Negative"
        else: 
            sentiment_label = "Negative"
        
        # Calculate leaning
        if compound > 0:
            lean_percentage = round((compound / 1) * 100)
            lean_result = {
                "direction": "Positive",
                "percentage": lean_percentage
            }
        elif compound < 0:
            lean_percentage = round((abs(compound) / 1) * 100)
            lean_result = {
                "direction": "Negative",
                "percentage": lean_percentage
            }
        else:
            lean_result = {
                "direction": "Balanced",
                "percentage": 0
            }
        
        # Format the results
        formatted_score = {
            "positive": round(combined_positive, 5),
            "negative": round(combined_negative, 5),
            "neutral": round(combined_neutral, 5),
            "compound": round(compound, 5),
            "sentiment": sentiment_label,
            "neutral_leaning": lean_result
        }
        
        return formatted_score

    def _analyze_multiple_chunks(self, text):
        """
        Process a long text by splitting into chunks and combining the results.
        This version properly handles each chunk independently to avoid tensor size mismatches.
        
        Args:
            text (str): The text to analyze
            
        Returns:
            dict: Formatted sentiment scores
        """
        # Split the text into chunks
        chunks = self._split_text_into_chunks(text, max_words_per_chunk=300)
        
        # Initialize aggregate scores for weighted averaging
        chunk_scores = []
        total_words = sum(len(chunk.split()) for chunk in chunks)
        
        # Process each chunk individually
        for chunk in chunks:
            if not chunk.strip():
                continue
                
            try:
                # Get sentiment for this chunk (each chunk is processed independently)
                chunk_result = self._analyze_single_chunk(chunk)
                
                # Weight by chunk size (number of words)
                chunk_weight = len(chunk.split()) / total_words
                
                chunk_scores.append({
                    "score": chunk_result,
                    "weight": chunk_weight
                })
            except Exception as e:
                self.logger.warning(f"Error processing chunk: {str(e)}")
                # Skip problematic chunks
                continue
        
        # Handle case where all chunks failed
        if not chunk_scores:
            self.logger.warning("All chunks failed to process, falling back to simple analysis")
            # Try a simple approach with heavy truncation as fallback
            try:
                # Get the first 250 words only for fallback analysis
                fallback_text = " ".join(text.split()[:250])
                return self._analyze_single_chunk(fallback_text)
            except Exception as e:
                self.logger.error(f"Fallback analysis also failed: {str(e)}")
                # Return a neutral sentiment if everything fails
                return {
                    "positive": 0.33,
                    "negative": 0.33,
                    "neutral": 0.34,
                    "compound": 0.0,
                    "sentiment": "Neutral",
                    "neutral_leaning": {"direction": "Balanced", "percentage": 0}
                }
        
        # Combine weighted scores
        combined_positive = sum(item["score"]["positive"] * item["weight"] for item in chunk_scores)
        combined_negative = sum(item["score"]["negative"] * item["weight"] for item in chunk_scores)
        combined_neutral = sum(item["score"]["neutral"] * item["weight"] for item in chunk_scores)
        
        # Ensure they sum to 1
        total = combined_positive + combined_negative + combined_neutral
        if total != 1.0 and total > 0:
            combined_positive /= total
            combined_negative /= total
            combined_neutral /= total
        
        # Calculate compound score
        compound = combined_positive - combined_negative
        
        # Determine overall sentiment based on combined scores
        if compound > 0.50:
            sentiment_label = "Positive"
        elif 0.10 < compound < 0.50:
            sentiment_label = "Slightly Positive"
        elif -0.10 < compound < 0.10:
            sentiment_label = "Neutral"
        elif -0.50 < compound < -0.10:
            sentiment_label = "Slightly Negative"
        else: 
            sentiment_label = "Negative"
        
        # Calculate leaning
        if compound > 0:
            lean_percentage = round((compound / 1) * 100)
            lean_result = {
                "direction": "Positive",
                "percentage": lean_percentage
            }
        elif compound < 0:
            lean_percentage = round((abs(compound) / 1) * 100)
            lean_result = {
                "direction": "Negative",
                "percentage": lean_percentage
            }
        else:
            lean_result = {
                "direction": "Balanced",
                "percentage": 0
            }
        
        # Format the results
        formatted_score = {
            "positive": round(combined_positive, 5),
            "negative": round(combined_negative, 5),
            "neutral": round(combined_neutral, 5),
            "compound": round(compound, 5),
            "sentiment": sentiment_label,
            "neutral_leaning": lean_result
        }
        
        return formatted_score


    def _split_text_into_chunks(self, text, max_words_per_chunk=300):
        """
        Split text into chunks of approximately max_words_per_chunk words.
        This improved version ensures chunks don't exceed token limits.
        
        Args:
            text (str): The text to split
            max_words_per_chunk (int): Maximum number of words per chunk
        
        Returns:
            list: List of text chunks
        """
        # Split text into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence in sentences:
            # Count words in this sentence
            sentence_word_count = len(sentence.split())
            
            # If this single sentence is too long, split it further
            if sentence_word_count > max_words_per_chunk:
                # If we have a current chunk, add it to chunks
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_word_count = 0
                
                # Split long sentence into smaller parts (by words)
                words = sentence.split()
                for i in range(0, len(words), max_words_per_chunk):
                    sentence_part = ' '.join(words[i:i + max_words_per_chunk])
                    chunks.append(sentence_part)
            
            # If adding this sentence would exceed the chunk size, start a new chunk
            elif current_word_count + sentence_word_count > max_words_per_chunk and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_word_count = sentence_word_count
            else:
                current_chunk.append(sentence)
                current_word_count += sentence_word_count
        
        # Add the last chunk if there is one
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        # Log the chunking process
        self.logger.info(f"Split text into {len(chunks)} chunks (original length: {len(text.split())} words)")
        
        return chunks

    def sentiment_score_refinement(self, text, sentiment_score):
        """
        Refine the score using predefined keywords 
        Args:
            text (str): The input text to analyze
            sentiment_score (list): Original scores [negative, neutral, positive]
        Returns:
            list: Refined sentiment scores [negative, neutral, positive]
        """
        tune_score = 0
        newText = text.lower()

        ori_negetive = sentiment_score[0]
        ori_neutral = sentiment_score[1]
        ori_positive = sentiment_score[2]

        # Check for positive keywords
        for keyword, adjustment in self.positive_keywords.items():
            if keyword in newText:
                tune_score += adjustment

        # Check for negative keywords
        for keyword, adjustment in self.negative_keywords.items():
            if keyword in newText:
                tune_score -= abs(adjustment)

        # Update the sentiment score
        # Apply positive adjustments
        refined_positive = min(1.0, max(0.0, ori_positive + tune_score)) #to ensure the score is between 0 and 1
        # Apply negative adjustments
        refined_negative = min(1.0, max(0.0, ori_negetive - tune_score)) 

        # Get the changes from the original score
        changes_positive = refined_positive - ori_positive
        changes_negative = refined_negative - ori_negetive

        # Update the neutral score
        refined_neutral = 1.0 - changes_positive - changes_negative
        
        # Normalize the scores if the sum of positive, negative, and neutral is not equal to 1
        total = refined_positive + refined_negative + refined_neutral
        if total != 1.0:
            normalised_positive = refined_positive / total
            normalised_negative = refined_negative / total
            normalised_neutral = refined_neutral / total

        # Return the refined scores
        sentiment_score = [normalised_negative, normalised_neutral, normalised_positive]
        
        return sentiment_score