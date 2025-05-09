import os
import json
import torch
import numpy as np
import logging
import datetime
from sklearn.model_selection import train_test_split
from transformers import (
    RobertaTokenizerFast, 
    RobertaForSequenceClassification, 
    Trainer, 
    TrainingArguments,
    DataCollatorWithPadding
)
from datasets import Dataset as ds
import evaluate
import shutil
from huggingface_hub import login

# Login to Hugging Face Hub - add your token here
login(token="your_actual_token_here")  # Replace with your actual token

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("server/sentiment-analysis/preprocessing/llm-tuning/tuning.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Define paths
model_path = "server/sentiment-analysis/preprocessing/agricultural-sentiment-model"  # Temporary path
data_file = "server/sentiment-analysis/preprocessing/llm-tuning/train_data.json"
train_history_path = "server/sentiment-analysis/preprocessing/llm-tuning/model_train_metrics.json"
model_name = "group21/agricultural-sentiment-model"  # HF Hub repository name

# Check if we want to continue training from a previously pushed model
try:
    logger.info("Checking if model exists on Hugging Face Hub")
    model = RobertaForSequenceClassification.from_pretrained(model_name)
    tokeniser = RobertaTokenizerFast.from_pretrained(model_name)
    logger.info(f"Found existing model on Hub: {model_name}, will continue training")
    is_continuing_training = True
except Exception as e:
    logger.info(f"No existing model found on Hub ({str(e)}), starting with pre-trained model")
    model = RobertaForSequenceClassification.from_pretrained("cardiffnlp/twitter-roberta-base-sentiment")
    tokeniser = RobertaTokenizerFast.from_pretrained("cardiffnlp/twitter-roberta-base-sentiment")
    is_continuing_training = False

# Load the evaluation metric
metric = evaluate.load("accuracy")
data_collator = DataCollatorWithPadding(tokenizer=tokeniser)

def load_training_data(file):
    """Load the training data from a JSON file."""
    logger.info(f"Attempting to load training data from {file}")
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    texts = []
    labels = []

    # Process the data
    for item in data:
        text = item['text']
        if "label" in item:
            if item['label']["POSITIVE"] == 1:
                label = 2  # 0 = negative, 1 = neutral, 2 = positive
            elif item['label']["NEUTRAL"] == 1:
                label = 1
            else:
                label = 0
        else:
            label = 2 if item.get("label", {}).get("POSITIVE", 0) == 1.0 else 0
        texts.append(text)
        labels.append(label)

    logger.info(f"Processed {len(texts)} data samples")
    logger.info(f"Label distribution: Negative={labels.count(0)}, Neutral={labels.count(1)}, Positive={labels.count(2)}")
    return texts, labels

# Try to load training data
try:
    texts, labels = load_training_data(data_file)
    logger.info(f"Successfully loaded {len(texts)} training examples")
except FileNotFoundError:
    logger.warning(f"Training file {data_file} not found, using sample data")
    # Here you would include sample data if the file isn't found
    # For now, we'll just log an error and exit
    logger.error("No sample data provided. Exiting.")
    exit(1)

# Split the data into training and validation sets
train_texts, val_texts, train_labels, val_labels = train_test_split(texts, labels, test_size=0.2, random_state=42)
logger.info(f"Split data: {len(train_texts)} training samples, {len(val_texts)} validation samples")

# Create datasets
train_dataset = ds.from_dict({"text": train_texts, "label": train_labels}) # Training dataset
val_dataset = ds.from_dict({"text": val_texts, "label": val_labels}) # Validation dataset

# Tokenize the data
def tokenize_function(examples):
    return tokeniser(examples["text"], truncation=True, padding="max_length", max_length=128)

# Tokenize the datasets
logger.info("Tokenizing datasets...")
tokenized_train = train_dataset.map(tokenize_function, batched=True)
tokenized_val = val_dataset.map(tokenize_function, batched=True)
logger.info("Tokenization complete")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=1)
    return metric.compute(predictions=predictions, references=labels)

# Define the training configuration, learning rate will differ if continuing training 
learning_rate = 2e-5 if is_continuing_training else 5e-5
epochs = 2 if is_continuing_training else 3  # Fewer epochs for continued training
logger.info(f"Training configuration: learning_rate={learning_rate}, epochs={epochs}, continuing_training={is_continuing_training}")

# Create temporary output directory if it doesn't exist
os.makedirs(model_path, exist_ok=True)

# Training arguments
training_args = TrainingArguments(
    output_dir=model_path,
    learning_rate=learning_rate,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    num_train_epochs=epochs,
    weight_decay=0.01,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    push_to_hub=True,
    hub_model_id=model_name,  # Specify the model ID on the Hub
    hub_strategy="end",  # Only push at the end of training
    report_to="none",  # Disable reporting for cleaner output
)

# Initialize Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_train,
    eval_dataset=tokenized_val,
    tokenizer=tokeniser,
    data_collator=data_collator,
    compute_metrics=compute_metrics,
)

# Start training the model
logger.info("Starting model training...")
train_result = trainer.train()
logger.info("Training complete")

# Save training metrics
metrics = train_result.metrics
logger.info(f"Training metrics: {metrics}")

final_eval = trainer.evaluate()
logger.info(f"Evaluation metrics: {final_eval}")

# Record metrics for tracking improvement over time
history_entry = {
    "timestamp": datetime.datetime.now().isoformat(),
    "dataset_size": len(texts),
    "training_metrics": metrics,
    "eval_metrics": final_eval,
    "is_continuing_training": is_continuing_training,
    "model_hub_id": model_name
}

# Save metrics history
logger.info(f"Saving metrics history to {train_history_path}")
if os.path.exists(train_history_path):
    with open(train_history_path, 'r') as f:
        metrics_history = json.load(f)
    metrics_history.append(history_entry)
else:
    metrics_history = [history_entry]

with open(train_history_path, 'w') as f:
    json.dump(metrics_history, f, indent=2)

# Clean up temporary files after pushing to Hub
if os.path.exists(model_path):
    logger.info(f"Cleaning up temporary model directory: {model_path}")
    shutil.rmtree(model_path)

logger.info(f"Model trained and pushed to Hugging Face Hub as {model_name}")
logger.info(f"Final evaluation results: {final_eval}")